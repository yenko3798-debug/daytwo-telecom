import { decode } from "node-wav";
import { config } from "./config.js";
import { logger } from "./logger.js";
const KEYWORD_FALLBACK = ["leave a message", "tone", "after the beep", "record your message", "voicemail"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function normalizeSettings(metadata) {
    const base = {
        enabled: Boolean(metadata?.enabled ?? false),
        sensitivity: clamp(metadata?.sensitivity ?? config.voicemailSensitivity ?? 0.55, 0.2, 0.95),
        provider: (metadata?.provider ?? config.transcriptionProvider ?? "openai").toLowerCase(),
        transcriptionModel: metadata?.transcriptionModel ?? config.transcriptionModel ?? "whisper-1",
        sampleSeconds: clamp(metadata?.sampleSeconds ?? config.voicemailSampleSeconds ?? 18, 4, 40),
        beepThreshold: clamp(metadata?.beepThreshold ?? config.voicemailBeepThreshold ?? 0.58, 0.1, 0.95),
        minBeepMs: clamp(metadata?.minBeepMs ?? config.voicemailMinBeepMs ?? 70, 20, 400),
        keywords: metadata?.keywords && metadata.keywords.length > 0 ? metadata.keywords.map((k) => k.toLowerCase()) : KEYWORD_FALLBACK,
    };
    return base;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
async function recordSnippet(client, channel, sessionId, sampleSeconds) {
    const recordingName = `vm-${sessionId}-${Date.now()}`;
    await new Promise((resolve, reject) => {
        channel.record({
            name: recordingName,
            format: "wav",
            beep: false,
            maxDurationSeconds: Math.ceil(sampleSeconds),
            ifExists: "overwrite",
        }, (error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
    await sleep(sampleSeconds * 1000);
    await client.recordings.stop({ recordingName }).catch(() => { });
    const buffer = (await client.recordings.getStoredFile({ recordingName }));
    await client.recordings.deleteStored({ recordingName }).catch(() => { });
    return buffer;
}
function analyzeBeep(buffer, settings) {
    try {
        const wav = decode(buffer);
        const channel = wav.channelData?.[0];
        if (!channel)
            return { detected: false, beepAtMs: null };
        const threshold = settings.beepThreshold;
        const minSamples = Math.max(1, Math.round((settings.minBeepMs / 1000) * wav.sampleRate));
        let streak = 0;
        let index = -1;
        for (let i = 0; i < channel.length; i += 1) {
            if (Math.abs(channel[i]) >= threshold) {
                streak += 1;
                if (streak >= minSamples) {
                    index = i - streak;
                    break;
                }
            }
            else {
                if (streak > 0) {
                    streak = 0;
                }
            }
        }
        if (index >= 0) {
            const beepAtMs = Math.max(0, Math.round((index / wav.sampleRate) * 1000));
            return { detected: true, beepAtMs };
        }
        return { detected: false, beepAtMs: null };
    }
    catch (error) {
        logger.warn("Unable to analyze beep", { error: error?.message ?? error });
        return { detected: false, beepAtMs: null };
    }
}
async function transcribeAudio(buffer, recordingName, settings) {
    if (settings.provider !== "openai") {
        return null;
    }
    if (!config.openAiApiKey) {
        logger.warn("OPENAI_API_KEY is not configured; skipping transcription");
        return null;
    }
    const form = new FormData();
    const audioCopy = new Uint8Array(buffer.byteLength);
    audioCopy.set(buffer);
    const blob = new Blob([audioCopy.buffer], { type: "audio/wav" });
    form.set("model", settings.transcriptionModel);
    form.set("temperature", "0");
    form.set("response_format", "json");
    form.set("file", blob, `${recordingName}.wav`);
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.openAiApiKey}`,
        },
        body: form,
    });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Transcription failed (${response.status}): ${text}`);
    }
    const data = await response.json();
    const text = typeof data?.text === "string" ? data.text : "";
    return {
        text,
        provider: "openai",
        model: settings.transcriptionModel,
        raw: data,
    };
}
function evaluateTranscript(text, keywords) {
    if (!text) {
        return { hits: [], score: 0 };
    }
    const normalized = text.toLowerCase();
    const hits = keywords.filter((keyword) => normalized.includes(keyword));
    const score = hits.length ? Math.min(0.6, hits.length / keywords.length) : 0;
    return { hits, score };
}
function buildResult(beep, transcript, settings) {
    const transcriptEval = evaluateTranscript(transcript?.text ?? "", settings.keywords);
    const beepScore = beep.detected ? 0.55 : 0;
    const combined = Math.min(1, beepScore + transcriptEval.score);
    const detected = combined >= settings.sensitivity;
    const reasons = [];
    if (beep.detected)
        reasons.push("Beep");
    if (transcriptEval.hits.length)
        reasons.push(`Transcript: ${transcriptEval.hits.join(", ")}`);
    return {
        detected,
        confidence: Number(combined.toFixed(2)),
        reason: reasons.join(" · ") || null,
        keywords: transcriptEval.hits,
    };
}
export function startVoicemailDetection(options) {
    const settings = normalizeSettings(options.metadata);
    if (!settings.enabled) {
        return;
    }
    (async () => {
        try {
            const buffer = await recordSnippet(options.client, options.channel, options.sessionId, settings.sampleSeconds);
            if (!buffer || buffer.length === 0) {
                logger.debug("Voicemail detection skipped, empty buffer", { sessionId: options.sessionId });
                return;
            }
            const beep = analyzeBeep(buffer, settings);
            const recordingName = `vm-${options.sessionId}`;
            let transcript = null;
            try {
                transcript = await transcribeAudio(buffer, recordingName, settings);
            }
            catch (error) {
                logger.warn("Transcription failed", { sessionId: options.sessionId, error: error?.message ?? error });
            }
            const summary = buildResult(beep, transcript, settings);
            const payload = {
                sessionId: options.sessionId,
                channelId: options.channelId,
                voicemail: {
                    detected: summary.detected,
                    confidence: summary.confidence,
                    reason: summary.reason,
                    transcript: transcript?.text ?? null,
                    provider: transcript?.provider ?? null,
                    model: transcript?.model ?? null,
                    beepDetected: beep.detected,
                    beepAtMs: beep.beepAtMs,
                    keywords: summary.keywords,
                    raw: {
                        transcript: transcript?.raw ?? null,
                        beep,
                    },
                },
            };
            await options.onResult(payload);
        }
        catch (error) {
            logger.warn("Voicemail detection errored", { sessionId: options.sessionId, error: error?.message ?? error });
        }
    })();
}
