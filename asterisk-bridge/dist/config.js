import dotenv from "dotenv";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";
dotenv.config();
function expandEnv(value) {
    return value.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name]?.trim() ?? "");
}
function requireEnv(key) {
    const value = process.env[key];
    if (!value || value.trim().length === 0) {
        throw new Error(`Missing environment variable ${key}`);
    }
    return expandEnv(value.trim());
}
function optionalEnv(key) {
    const value = process.env[key];
    if (!value || value.trim().length === 0)
        return undefined;
    return expandEnv(value.trim());
}
function ensureDir(path) {
    if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
    }
}
const httpPort = Number.parseInt(optionalEnv("HTTP_PORT") ?? "4000", 10);
const ringTimeout = Number.parseInt(optionalEnv("DEFAULT_RING_TIMEOUT") ?? "45", 10);
const dialTimeout = Number.parseInt(optionalEnv("DEFAULT_DIAL_TIMEOUT") ?? "30", 10);
const panelBaseUrl = requireEnv("PANEL_BASE_URL").replace(/\/$/, "");
const mediaBaseUrl = (optionalEnv("MEDIA_BASE_URL") ?? panelBaseUrl).replace(/\/$/, "");
const panelWebhookUrl = requireEnv("PANEL_WEBHOOK_URL");
const ariBaseUrl = requireEnv("ARI_BASE_URL").replace(/\/$/, "");
const pjsipDir = resolve(requireEnv("ASTERISK_PJSIP_DIR"));
const soundsRoot = resolve(requireEnv("ASTERISK_SOUNDS_ROOT"));
const soundsDir = resolve(optionalEnv("ASTERISK_SOUNDS_DIR") ?? soundsRoot);
const cacheDir = resolve(optionalEnv("SOUNDS_CACHE_DIR") ?? soundsDir);
const soundPrefix = optionalEnv("ASTERISK_SOUND_PREFIX") ?? undefined;
const soundExtension = optionalEnv("ASTERISK_SOUND_EXTENSION") ?? undefined;
ensureDir(pjsipDir);
ensureDir(soundsRoot);
ensureDir(soundsDir);
ensureDir(cacheDir);
const openAiApiKey = optionalEnv("OPENAI_API_KEY");
const transcriptionProvider = optionalEnv("TRANSCRIPTION_PROVIDER") ?? "openai";
const transcriptionModel = optionalEnv("TRANSCRIPTION_MODEL") ?? "whisper-1";
const voicemailSampleSeconds = Number.parseInt(optionalEnv("VOICEMAIL_SAMPLE_SECONDS") ?? "18", 10);
const voicemailSensitivity = Number.parseFloat(optionalEnv("VOICEMAIL_SENSITIVITY") ?? "0.55");
const voicemailBeepThreshold = Number.parseFloat(optionalEnv("VOICEMAIL_BEEP_THRESHOLD") ?? "0.58");
const voicemailMinBeepMs = Number.parseInt(optionalEnv("VOICEMAIL_MIN_BEEP_MS") ?? "70", 10);
export const config = {
    httpPort,
    bridgeToken: requireEnv("BRIDGE_TOKEN"),
    panelBaseUrl,
    mediaBaseUrl,
    panelAriToken: requireEnv("PANEL_ARI_TOKEN"),
    panelWebhookUrl,
    ariBaseUrl,
    ariUsername: requireEnv("ARI_USERNAME"),
    ariPassword: requireEnv("ARI_PASSWORD"),
    ariApplication: requireEnv("ARI_APPLICATION"),
    transport: requireEnv("ASTERISK_TRANSPORT"),
    context: requireEnv("ASTERISK_CONTEXT"),
    codecs: requireEnv("ASTERISK_CODECS").split(",").map((v) => v.trim()).filter((v) => v.length > 0),
    pjsipDir,
    soundsDir,
    soundsRoot,
    cacheDir,
    soundPrefix,
    soundExtension,
    ttsProvider: optionalEnv("TTS_PROVIDER") ?? "pico",
    openAiApiKey,
    transcriptionProvider,
    transcriptionModel,
    voicemailSampleSeconds,
    voicemailSensitivity,
    voicemailBeepThreshold,
    voicemailMinBeepMs,
    ringTimeout,
    dialTimeout,
    logLevel: optionalEnv("LOG_LEVEL") ?? "info",
};
