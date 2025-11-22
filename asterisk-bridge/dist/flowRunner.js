import AriClient from "ari-client";
import { promises as fs } from "fs";
import { join, relative, basename } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { config } from "./config.js";
import { hashKey, newId } from "./utils.js";
const execFileAsync = promisify(execFile);
let client;
const sessionsByChannel = new Map();
const bridges = new Map();
async function downloadToCache(url) {
    const key = hashKey(url);
    const extensionMatch = url.match(/\.(wav|ulaw|sln16|gsm|mp3|ogg)(\?.*)?$/i);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "wav";
    const file = join(config.cacheDir, `${key}.${extension}`);
    try {
        await fs.access(file);
        return file;
    }
    catch {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Unable to download media ${url}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        await fs.writeFile(file, Buffer.from(arrayBuffer));
        return file;
    }
}
async function synthesizeTts(text, voice, language) {
    if (config.ttsProvider !== "pico") {
        throw new Error("Unsupported TTS provider");
    }
    const key = hashKey(`${language ?? "en-US"}:${voice ?? "default"}:${text}`);
    const file = join(config.cacheDir, `${key}.wav`);
    try {
        await fs.access(file);
        return file;
    }
    catch {
        const languageCode = language ?? "en-US";
        await execFileAsync("pico2wave", ["-l", languageCode, "-w", file, text]);
        return file;
    }
}
async function tryTranscode(command, args) {
    try {
        await execFileAsync(command, args);
        return true;
    }
    catch {
        return false;
    }
}
async function fileExists(path) {
    try {
        await fs.access(path);
        return true;
    }
    catch {
        return false;
    }
}
async function normalizeToWav(input, output) {
    const tmp = `${output}.tmp`;
    await fs.rm(tmp, { force: true }).catch(() => { });
    const soxArgs = [input, "-r", "8000", "-c", "1", "-b", "16", "-e", "signed-integer", tmp];
    if (!(await tryTranscode("sox", soxArgs))) {
        const ffmpegArgs = ["-y", "-i", input, "-ar", "8000", "-ac", "1", "-sample_fmt", "s16", tmp];
        if (!(await tryTranscode("ffmpeg", ffmpegArgs))) {
            throw new Error("Unable to normalize audio to 8k mono WAV. Install sox or ffmpeg.");
        }
    }
    await fs.rename(tmp, output);
    return output;
}
async function convertWavToUlaw(input, output) {
    const tmp = `${output}.tmp`;
    await fs.rm(tmp, { force: true }).catch(() => { });
    const soxArgs = [input, "-t", "ulaw", "-r", "8000", "-c", "1", tmp];
    if (!(await tryTranscode("sox", soxArgs))) {
        const ffmpegArgs = ["-y", "-i", input, "-ar", "8000", "-ac", "1", "-f", "mulaw", tmp];
        if (!(await tryTranscode("ffmpeg", ffmpegArgs))) {
            throw new Error("Unable to convert audio to ulaw. Install sox or ffmpeg.");
        }
    }
    await fs.rename(tmp, output);
    return output;
}
async function ensureNormalizedVariants(file) {
    const fileName = basename(file);
    const key = fileName.replace(/\.[^/.]+$/, "") || hashKey(file);
    const base = join(config.soundsDir, key);
    const wavPath = `${base}.wav`;
    const ulawPath = `${base}.ulaw`;
    const needsNormalize = !(await fileExists(wavPath)) || file.toLowerCase().endsWith(".wav");
    if (needsNormalize) {
        await normalizeToWav(file, wavPath);
    }
    if (!(await fileExists(ulawPath))) {
        await convertWavToUlaw(wavPath, ulawPath);
    }
    return { wav: wavPath, ulaw: ulawPath };
}
function normalizePrefix(value) {
    if (!value)
        return "";
    const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
    return trimmed.length ? `${trimmed}/` : "";
}
async function ensureMedia(playback) {
    const file = playback.mode === "file"
        ? await downloadToCache(playback.url)
        : await synthesizeTts(playback.text, playback.voice, playback.language);
    const variants = await ensureNormalizedVariants(file);
    const relativePath = relative(config.soundsRoot, variants.ulaw).replace(/\\/g, "/").replace(/\.ulaw$/, "");
    if (relativePath.startsWith("..")) {
        throw new Error("Media files must be inside ASTERISK_SOUNDS_ROOT");
    }
    let sanitizedPath = relativePath.replace(/^\/+/, "");
    const prefix = normalizePrefix(config.soundPrefix);
    if (prefix.length > 0) {
        const prefixBase = prefix.replace(/\/$/, "");
        const duplicateSegment = `${prefixBase}/${prefixBase}/`;
        while (sanitizedPath.startsWith(duplicateSegment)) {
            sanitizedPath = sanitizedPath.slice(prefixBase.length + 1);
        }
    }
    const needsPrefix = prefix.length > 0 && sanitizedPath.startsWith(prefix)
        ? sanitizedPath
        : `${prefix}${sanitizedPath}`;
    return `sound:${needsPrefix}`;
}
const playbackMediaCache = new Map();
function playbackCacheKey(playback) {
    if (playback.mode === "file") {
        return `file:${playback.url}`;
    }
    return `tts:${playback.language ?? ""}:${playback.voice ?? ""}:${playback.text}`;
}
function loadPlaybackMedia(playback) {
    const key = playbackCacheKey(playback);
    let task = playbackMediaCache.get(key);
    if (!task) {
        task = ensureMedia(playback).catch((error) => {
            playbackMediaCache.delete(key);
            throw error;
        });
        playbackMediaCache.set(key, task);
    }
    return task;
}
function normalizeHangupCause(reason) {
    if (typeof reason === "number" && Number.isFinite(reason)) {
        return reason;
    }
    if (typeof reason === "string") {
        const value = reason.trim().toLowerCase();
        if (!value) {
            return undefined;
        }
        const mapped = {
            normal: 16,
            completed: 16,
            busy: 17,
            congestion: 34,
            rejected: 21,
            noanswer: 19,
        };
        if (mapped[value] !== undefined) {
            return mapped[value];
        }
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return undefined;
}
async function warmFlowMedia(flow) {
    const tasks = [];
    for (const node of flow.nodes) {
        if (node.type === "play") {
            tasks.push(loadPlaybackMedia(node.playback));
        }
        else if (node.type === "gather" && node.prompt) {
            tasks.push(loadPlaybackMedia(node.prompt));
        }
    }
    await Promise.allSettled(tasks);
}
async function notifyPanel(event, body) {
    try {
        const response = await fetch(config.panelWebhookUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ event, ...body }),
        });
        if (!response.ok) {
            const text = await response.text();
            console.error(`Webhook ${event} failed: ${text}`);
        }
    }
    catch (error) {
        console.error(`Webhook ${event} error: ${error?.message ?? error}`);
    }
}
function extractVoicemailConfig(source) {
    if (!source || typeof source !== "object" || Array.isArray(source))
        return null;
    const raw = source.voicemail;
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return null;
    if (!raw.enabled)
        return null;
    const retryLimit = Number.isFinite(raw.retryLimit) ? Math.max(0, Number(raw.retryLimit)) : 0;
    const attempt = Number.isFinite(raw.attempt) ? Math.max(0, Number(raw.attempt)) : 0;
    return {
        enabled: true,
        retryLimit,
        attempt,
        hangupOnMachine: raw.hangupOnMachine !== false,
        assumeHumanOnTimeout: raw.assumeHumanOnTimeout !== false,
    };
}
function clearVoicemailTimer(state) {
    if (state.voicemail?.detectionTimer) {
        clearTimeout(state.voicemail.detectionTimer);
        state.voicemail.detectionTimer = undefined;
    }
}
function resolveVoicemailListeners(state, status) {
    if (!state.voicemail)
        return;
    const listeners = state.voicemail.listeners ?? [];
    state.voicemail.listeners = [];
    for (const listener of listeners) {
        try {
            listener(status);
        }
        catch (error) {
            console.error(`Voicemail listener error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
function waitForVoicemailResult(state) {
    if (!state.voicemail)
        return Promise.resolve("unknown");
    if (state.voicemail.decided) {
        return Promise.resolve(state.voicemail.status);
    }
    return new Promise((resolve) => {
        state.voicemail?.listeners.push(resolve);
    });
}
function armVoicemailTimer(state) {
    if (!state.voicemail || state.voicemail.decided)
        return;
    clearVoicemailTimer(state);
    const timeout = setTimeout(() => {
        if (!state.voicemail || state.voicemail.decided)
            return;
        if (state.voicemail.config.assumeHumanOnTimeout) {
            finalizeVoicemailHuman(state);
        }
        else {
            triggerVoicemail(state, { reason: "timeout" }).catch((error) => {
                console.error(`Voicemail trigger error: ${error?.message ?? error}`);
            });
        }
    }, config.voicemailDetection.detectionTimeoutMs);
    state.voicemail.detectionTimer = timeout;
}
function finalizeVoicemailHuman(state) {
    if (!state.voicemail || state.voicemail.decided)
        return;
    clearVoicemailTimer(state);
    state.voicemail.decided = true;
    state.voicemail.status = "human";
    resolveVoicemailListeners(state, "human");
}
async function triggerVoicemail(state, metrics) {
    if (!state.voicemail || state.voicemail.decided)
        return;
    clearVoicemailTimer(state);
    state.voicemail.decided = true;
    state.voicemail.status = "machine";
    const attempt = state.voicemail.config.attempt ?? 0;
    const retryEligible = attempt < state.voicemail.config.retryLimit;
    state.voicemail.config.attempt = attempt + 1;
    resolveVoicemailListeners(state, "machine");
    try {
        await notifyPanel("call.voicemail", {
            sessionId: state.sessionId,
            channelId: state.channelId,
            metadata: {
                detection: metrics,
                retryEligible,
            },
        });
    }
    catch (error) {
        console.error(`Voicemail notify failed: ${error?.message ?? error}`);
    }
    if (state.voicemail.config.hangupOnMachine === false) {
        return;
    }
    state.completed = true;
    state.completionSent = true;
    try {
        await new Promise((resolve) => {
            state.channel.hangup({}, () => resolve());
        });
    }
    catch { }
}
function handleTalkingEvent(event, started) {
    const state = sessionsByChannel.get(event.channel.id);
    if (!state || !state.voicemail || state.voicemail.decided)
        return;
    const cfg = config.voicemailDetection;
    const now = Date.now();
    if (!state.answeredAt) {
        state.answeredAt = now;
    }
    if (started) {
        const silenceMs = now - (state.answeredAt ?? state.startedAt);
        if (state.voicemail.firstSilenceMs === undefined) {
            state.voicemail.firstSilenceMs = silenceMs;
        }
        if (silenceMs >= cfg.maxSilenceBeforeSpeechMs) {
            triggerVoicemail(state, { reason: "silence", silenceMs }).catch((error) => {
                console.error(`Voicemail trigger error: ${error?.message ?? error}`);
            });
            return;
        }
        state.voicemail.speechStart = now;
        return;
    }
    if (!state.voicemail.speechStart)
        return;
    const speechMs = now - state.voicemail.speechStart;
    state.voicemail.speechStart = undefined;
    if (state.voicemail.firstSpeechMs === undefined) {
        state.voicemail.firstSpeechMs = speechMs;
    }
    if (speechMs >= cfg.machineSpeechMinMs) {
        triggerVoicemail(state, { reason: "longGreeting", speechMs }).catch((error) => {
            console.error(`Voicemail trigger error: ${error?.message ?? error}`);
        });
    }
    else if (speechMs <= cfg.humanSpeechMaxMs) {
        finalizeVoicemailHuman(state);
    }
}
async function fetchSession(sessionId) {
    const response = await fetch(`${config.panelBaseUrl}/api/ari/sessions/${sessionId}`, {
        headers: {
            "x-ari-token": config.panelAriToken,
        },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Session lookup failed: ${text}`);
    }
    return (await response.json());
}
async function playMedia(channel, media) {
    return new Promise((resolve, reject) => {
        channel.play({ media }, (error, playback) => {
            if (error) {
                reject(error);
                return;
            }
            playback.once("PlaybackFinished", () => resolve());
            playback.once("PlaybackStopped", () => resolve());
            playback.once("PlaybackFailed", (event) => {
                reject(new Error(event?.cause ?? "Playback failed"));
            });
        });
    });
}
async function pause(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
function createSessionState(payload, channel) {
    if (!payload.flow) {
        throw new Error("Flow definition missing");
    }
    const flow = payload.flow.definition;
    const nodeMap = new Map();
    flow.nodes.forEach((node) => nodeMap.set(node.id, node));
    if (!nodeMap.has(flow.entry)) {
        throw new Error(`Flow entry node ${flow.entry} missing`);
    }
    const sessionMeta = payload.session.metadata && typeof payload.session.metadata === "object" && !Array.isArray(payload.session.metadata)
        ? payload.session.metadata
        : null;
    const campaignMeta = payload.campaign.metadata && typeof payload.campaign.metadata === "object" && !Array.isArray(payload.campaign.metadata)
        ? payload.campaign.metadata
        : null;
    const state = {
        sessionId: payload.session.id,
        channelId: channel.id,
        channel,
        payload,
        flow,
        nodeMap,
        startedAt: Date.now(),
        digits: "",
        variables: {},
        completed: false,
        completionSent: false,
    };
    const hasActivityNode = flow.nodes.some((node) => node.type === "activity");
    let voicemailConfig = extractVoicemailConfig(sessionMeta) ?? extractVoicemailConfig(campaignMeta);
    if (!voicemailConfig && hasActivityNode) {
        voicemailConfig = {
            enabled: true,
            retryLimit: 0,
            attempt: 0,
            hangupOnMachine: false,
            assumeHumanOnTimeout: false,
        };
    }
    else if (voicemailConfig && hasActivityNode) {
        voicemailConfig = {
            ...voicemailConfig,
            hangupOnMachine: false,
            assumeHumanOnTimeout: false,
        };
    }
    if (voicemailConfig) {
        state.voicemail = {
            config: voicemailConfig,
            status: "unknown",
            decided: false,
            listeners: [],
        };
    }
    return state;
}
async function handleGather(state, node) {
    let attempt = 0;
    while (attempt < node.attempts) {
        if (node.prompt) {
            const media = await loadPlaybackMedia(node.prompt);
            await playMedia(state.channel, media);
        }
        const digits = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                state.gather = undefined;
                resolve("");
            }, node.timeoutSeconds * 1000);
            state.gather = {
                node,
                input: "",
                resolve: (value) => {
                    clearTimeout(timer);
                    state.gather = undefined;
                    resolve(value);
                },
                reject: (error) => {
                    clearTimeout(timer);
                    state.gather = undefined;
                    reject(error);
                },
                timer,
                attempts: attempt,
            };
        });
        if (digits.length >= node.minDigits) {
            state.variables[node.variable] = digits;
            state.digits += digits;
            const aggregateDigits = state.digits;
            notifyPanel("call.dtmf", {
                sessionId: state.sessionId,
                channelId: state.channelId,
                dtmf: aggregateDigits,
                digits,
                variable: node.variable,
            });
            const branch = node.branches[digits] ?? node.defaultNext;
            return branch ?? null;
        }
        attempt += 1;
    }
    return node.defaultNext ?? null;
}
async function handleActivity(state, node) {
    if (!state.voicemail) {
        state.voicemail = {
            config: {
                enabled: true,
                retryLimit: 0,
                attempt: 0,
                hangupOnMachine: false,
                assumeHumanOnTimeout: false,
            },
            status: "unknown",
            decided: false,
            listeners: [],
        };
    }
    else {
        state.voicemail.config.hangupOnMachine = false;
        state.voicemail.config.assumeHumanOnTimeout = false;
        if (!state.voicemail.listeners) {
            state.voicemail.listeners = [];
        }
    }
    if (!state.voicemail.decided) {
        armVoicemailTimer(state);
    }
    const result = await waitForVoicemailResult(state);
    if (result === "human") {
        const digit = (node.humanDigit ?? "1").charAt(0);
        if (digit) {
            state.variables[`activity:${node.id}`] = digit;
            state.digits += digit;
            const aggregateDigits = state.digits;
            notifyPanel("call.dtmf", {
                sessionId: state.sessionId,
                channelId: state.channelId,
                dtmf: aggregateDigits,
                digits: digit,
                variable: `activity:${node.id}`,
            });
        }
        return node.next ?? node.defaultNext ?? null;
    }
    return node.defaultNext ?? node.next ?? null;
}
async function handleDial(state, node) {
    const bridgeId = newId("bridge");
    const bridge = client.Bridge();
    const timeoutMs = (node.timeoutSeconds ?? config.dialTimeout) * 1000;
    await new Promise((resolve, reject) => {
        bridge.create({ type: "mixing", bridgeId }, (error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
    await new Promise((resolve, reject) => {
        bridge.addChannel({ channel: state.channel.id }, (error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
    const dialPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            bridges.delete(bridgeId);
            reject(new Error("Dial timed out"));
        }, timeoutMs);
        const bridgeState = {
            id: bridgeId,
            sessionId: state.sessionId,
            resolve: () => {
                clearTimeout(timeout);
                bridges.delete(bridgeId);
                resolve();
            },
            reject: (error) => {
                clearTimeout(timeout);
                bridges.delete(bridgeId);
                reject(error);
            },
            timeout,
            bridge,
        };
        bridges.set(bridgeId, bridgeState);
    });
    const callerId = node.callerId ?? state.payload.session.callerId;
    const appArgs = ["bridge", state.sessionId, bridgeId].join(",");
    try {
        await new Promise((resolve, reject) => {
            client.channels.originate({
                endpoint: node.endpoint,
                app: config.ariApplication,
                appArgs,
                callerId,
                timeout: node.timeoutSeconds ?? config.dialTimeout,
            }, (error) => {
                if (error)
                    reject(error);
                else
                    resolve();
            });
        });
        await dialPromise;
    }
    finally {
        bridges.delete(bridgeId);
        await new Promise((resolve, reject) => {
            bridge.destroy((error) => {
                if (error)
                    reject(error);
                else
                    resolve();
            });
        }).catch(() => { });
    }
    return node.next ?? null;
}
function assertNever(value) {
    throw new Error(`Unsupported node ${value.type}`);
}
async function runFlow(state) {
    let current = state.flow.entry;
    while (current !== null && !state.completed) {
        const node = state.nodeMap.get(current);
        if (!node) {
            throw new Error(`Flow node ${current} missing`);
        }
        switch (node.type) {
            case "play": {
                const media = await loadPlaybackMedia(node.playback);
                await playMedia(state.channel, media);
                current = node.next ?? null;
                break;
            }
            case "gather": {
                current = await handleGather(state, {
                    ...node,
                    attempts: node.attempts ?? 1,
                    maxDigits: node.maxDigits ?? 1,
                    minDigits: node.minDigits ?? 1,
                    timeoutSeconds: node.timeoutSeconds ?? 5,
                });
                break;
            }
            case "activity": {
                current = await handleActivity(state, node);
                break;
            }
            case "dial": {
                current = await handleDial(state, node);
                break;
            }
            case "pause": {
                await pause(node.durationSeconds * 1000);
                current = node.next ?? null;
                break;
            }
            case "hangup": {
                state.completed = true;
                const cause = normalizeHangupCause(node.reason);
                const params = cause !== undefined ? { cause } : {};
                await new Promise((resolve) => {
                    state.channel.hangup(params, () => resolve());
                }).catch(() => { });
                return;
            }
            default:
                assertNever(node);
        }
    }
}
async function handleBridgeStart(event, channel) {
    const sessionId = event.args[1];
    const bridgeId = event.args[2];
    const bridgeState = bridges.get(bridgeId);
    if (!bridgeState) {
        await new Promise((resolve) => {
            channel.hangup({}, () => resolve());
        });
        return;
    }
    bridgeState.channelId = channel.id;
    await new Promise((resolve, reject) => {
        channel.answer((error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
    await new Promise((resolve, reject) => {
        bridgeState.bridge.addChannel({ channel: channel.id }, (error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
}
async function handleSessionStart(event, channel) {
    const sessionId = event.args[2];
    const payload = await fetchSession(sessionId);
    const state = createSessionState(payload, channel);
    sessionsByChannel.set(channel.id, state);
    warmFlowMedia(state.flow).catch((error) => {
        console.error(`Media warmup failed: ${error?.message ?? error}`);
    });
    await new Promise((resolve, reject) => {
        channel.answer((error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
    state.answeredAt = Date.now();
    if (state.voicemail) {
        armVoicemailTimer(state);
    }
    await notifyPanel("call.answered", {
        sessionId: state.sessionId,
        channelId: channel.id,
    });
    try {
        await runFlow(state);
    }
    catch (error) {
        await notifyPanel("call.failed", {
            sessionId: state.sessionId,
            error: error?.message ?? String(error),
        });
        sessionsByChannel.delete(channel.id);
        await new Promise((resolve) => {
            channel.hangup({}, () => resolve());
        });
    }
}
function handleDtmf(event) {
    const state = sessionsByChannel.get(event.channel.id);
    if (!state)
        return;
    if (state.gather) {
        state.gather.input += event.digit;
        if (state.gather.input.length >= state.gather.node.maxDigits) {
            const digits = state.gather.input;
            const gather = state.gather;
            state.gather = undefined;
            gather.resolve(digits);
        }
    }
}
async function handleStasisEnd(event) {
    const state = sessionsByChannel.get(event.channel.id);
    if (!state) {
        const bridgeEntry = Array.from(bridges.values()).find((b) => b.channelId === event.channel.id);
        if (bridgeEntry) {
            bridgeEntry.resolve();
        }
        return;
    }
    clearVoicemailTimer(state);
    sessionsByChannel.delete(event.channel.id);
    if (!state.completionSent) {
        state.completionSent = true;
        const duration = Math.max(0, Math.round((Date.now() - state.startedAt) / 1000));
        await notifyPanel("call.completed", {
            sessionId: state.sessionId,
            durationSeconds: duration,
            dtmf: state.digits.length > 0 ? state.digits : undefined,
        });
    }
}
export async function startFlowRunner() {
    if (client)
        return;
    client = await AriClient.connect(config.ariBaseUrl, config.ariUsername, config.ariPassword);
    client.on("StasisStart", async (event, channel) => {
        try {
            if (event.args && event.args[0] === "bridge") {
                await handleBridgeStart(event, channel);
            }
            else {
                await handleSessionStart(event, channel);
            }
        }
        catch (error) {
            console.error(`StasisStart error: ${error?.message ?? error}`);
        }
    });
    client.on("StasisEnd", async (event) => {
        try {
            await handleStasisEnd(event);
        }
        catch (error) {
            console.error(`StasisEnd error: ${error?.message ?? error}`);
        }
    });
    client.on("ChannelDestroyed", (event) => {
        const bridgeEntry = Array.from(bridges.values()).find((b) => b.channelId === event.channel.id);
        if (bridgeEntry) {
            bridgeEntry.resolve();
        }
    });
    client.on("ChannelDtmfReceived", (event) => {
        try {
            handleDtmf(event);
        }
        catch (error) {
            console.error(`DTMF handler error: ${error?.message ?? error}`);
        }
    });
    client.on("ChannelTalkingStarted", (event) => {
        try {
            handleTalkingEvent(event, true);
        }
        catch (error) {
            console.error(`TalkingStarted error: ${error?.message ?? error}`);
        }
    });
    client.on("ChannelTalkingFinished", (event) => {
        try {
            handleTalkingEvent(event, false);
        }
        catch (error) {
            console.error(`TalkingFinished error: ${error?.message ?? error}`);
        }
    });
    client.start(config.ariApplication);
}
