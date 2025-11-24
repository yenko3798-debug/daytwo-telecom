import AriClient from "ari-client";
import { promises as fs } from "fs";
import { basename, join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { config } from "./config.js";
import { hashKey, newId } from "./utils.js";
import { logger } from "./logger.js";
const execFileAsync = promisify(execFile);
const STATIC_SOUNDS_ROOT = "/usr/share/asterisk/sounds";
const STATIC_PREFIX = "custom";
const STATIC_CACHE_DIR = "/var/lib/asterisk/media-cache";
let staticDirsReady = null;
const normalizationTasks = new Map();
const SOX_BIN = process.env.SOX_BIN || "/usr/bin/sox";
const FFMPEG_BIN = process.env.FFMPEG_BIN || "/usr/bin/ffmpeg";
function ensureStaticDirs() {
    if (!staticDirsReady) {
        staticDirsReady = (async () => {
            await fs.mkdir(STATIC_CACHE_DIR, { recursive: true }).catch(() => { });
            const soundsDir = STATIC_PREFIX.length ? join(STATIC_SOUNDS_ROOT, STATIC_PREFIX) : STATIC_SOUNDS_ROOT;
            await fs.mkdir(soundsDir, { recursive: true }).catch(() => { });
        })();
    }
    return staticDirsReady;
}
let client;
const sessionsByChannel = new Map();
const bridges = new Map();
function sessionLogger(state) {
    return logger.child({ sessionId: state.sessionId });
}
function isPrivateHostname(hostname) {
    const lower = hostname.toLowerCase();
    if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1")
        return true;
    if (lower.endsWith(".local"))
        return true;
    if (lower.startsWith("10."))
        return true;
    if (lower.startsWith("192.168."))
        return true;
    if (lower.startsWith("169.254."))
        return true;
    const match172 = lower.match(/^172\.(\d+)\./);
    if (match172) {
        const value = Number(match172[1]);
        if (value >= 16 && value <= 31)
            return true;
    }
    if (lower.startsWith("fc") || lower.startsWith("fd"))
        return true;
    return false;
}
function buildMediaBaseUrl(path) {
    return new URL(path, `${config.mediaBaseUrl}/`).toString();
}
function resolveMediaUrl(raw) {
    if (!raw || raw.trim().length === 0) {
        throw new Error("Playback URL is missing");
    }
    const value = raw.trim();
    if (/^https?:\/\//i.test(value)) {
        const parsed = new URL(value);
        if (isPrivateHostname(parsed.hostname) &&
            !isPrivateHostname(new URL(config.mediaBaseUrl).hostname)) {
            return buildMediaBaseUrl(parsed.pathname + parsed.search + parsed.hash);
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error("Playback files must be served over HTTP or HTTPS");
        }
        return parsed.toString();
    }
    return buildMediaBaseUrl(value);
}
function mediaBaseId(file) {
    return basename(file).replace(/\.[^/.]+$/, "");
}
async function ensureNonEmpty(file) {
    const stats = await fs.stat(file);
    if (!stats.isFile() || stats.size < 200) {
        throw new Error("Normalized audio has no content");
    }
}
async function downloadToCache(url) {
    await ensureStaticDirs();
    const absoluteUrl = resolveMediaUrl(url);
    const key = hashKey(absoluteUrl);
    const extensionMatch = absoluteUrl.match(/\.(wav|ulaw|sln16|gsm|mp3|ogg)(\?.*)?$/i);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "wav";
    const file = join(STATIC_CACHE_DIR, `${key}.${extension}`);
    try {
        await fs.access(file);
        logger.debug("Media cache hit", { url: absoluteUrl, file });
        return file;
    }
    catch {
        logger.debug("Media cache miss", { url: absoluteUrl, file });
        const response = await fetch(absoluteUrl);
        if (!response.ok) {
            throw new Error(`Unable to download media ${absoluteUrl}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        await fs.writeFile(file, Buffer.from(arrayBuffer));
        logger.debug("Media cached", { url: absoluteUrl, file });
        return file;
    }
}
async function synthesizeTts(text, voice, language) {
    await ensureStaticDirs();
    if (config.ttsProvider !== "pico") {
        throw new Error("Unsupported TTS provider");
    }
    const key = hashKey(`${language ?? "en-US"}:${voice ?? "default"}:${text}`);
    const file = join(STATIC_CACHE_DIR, `${key}.wav`);
    try {
        await fs.access(file);
        logger.debug("TTS cache hit", { file, voice, language });
        return file;
    }
    catch {
        const languageCode = language ?? "en-US";
        logger.debug("Synthesizing TTS prompt", { file, voice, language: languageCode, chars: text.length });
        await execFileAsync("pico2wave", ["-l", languageCode, "-w", file, text]);
        return file;
    }
}
async function tryTranscode(command, args, label) {
    try {
        await execFileAsync(command, args);
        return true;
    }
    catch (error) {
        logger.error(label, {
            command,
            args,
            error: error?.message ?? error,
            stderr: error?.stderr,
            stdout: error?.stdout,
        });
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
    const tmp = `${output}.tmp.wav`;
    await fs.rm(tmp, { force: true }).catch(() => { });
    const soxArgs = [input, "-r", "8000", "-c", "1", "-b", "16", "-e", "signed-integer", tmp];
    logger.debug("Normalizing audio via sox", { input, output, binary: SOX_BIN });
    const soxResult = await tryTranscode(SOX_BIN, soxArgs, "sox normalize");
    if (!soxResult) {
        const ffmpegArgs = ["-y", "-i", input, "-ar", "8000", "-ac", "1", "-sample_fmt", "s16", tmp];
        logger.debug("Normalizing audio via ffmpeg fallback", { input, output, binary: FFMPEG_BIN });
        const ffmpegResult = await tryTranscode(FFMPEG_BIN, ffmpegArgs, "ffmpeg normalize");
        if (!ffmpegResult) {
            const soxLog = join(STATIC_CACHE_DIR, "sox-error.log");
            const ffmpegLog = join(STATIC_CACHE_DIR, "ffmpeg-error.log");
            await fs.writeFile(soxLog, JSON.stringify({ input, output, soxArgs }, null, 2));
            await fs.writeFile(ffmpegLog, JSON.stringify({ input, output, ffmpegArgs }, null, 2));
            throw new Error("Unable to normalize audio to 8k mono WAV. Install sox or ffmpeg.");
        }
    }
    await fs.rename(tmp, output);
    return output;
}
async function convertWavToUlaw(input, output) {
    const tmp = `${output}.tmp.wav`;
    await fs.rm(tmp, { force: true }).catch(() => { });
    const soxArgs = [input, "-t", "ulaw", "-r", "8000", "-c", "1", tmp];
    logger.debug("Converting WAV to ulaw via sox", { input, output, binary: SOX_BIN });
    if (!(await tryTranscode(SOX_BIN, soxArgs, "sox ulaw"))) {
        const ffmpegArgs = ["-y", "-i", input, "-ar", "8000", "-ac", "1", "-f", "mulaw", tmp];
        logger.debug("Converting WAV to ulaw via ffmpeg fallback", { input, output, binary: FFMPEG_BIN });
        if (!(await tryTranscode(FFMPEG_BIN, ffmpegArgs, "ffmpeg ulaw"))) {
            throw new Error("Unable to convert audio to ulaw. Install sox or ffmpeg.");
        }
    }
    await fs.rename(tmp, output);
    return output;
}
async function ensureNormalizedVariants(sourceFile) {
    await ensureStaticDirs();
    const baseId = mediaBaseId(sourceFile);
    const storageDir = STATIC_PREFIX.length ? join(STATIC_SOUNDS_ROOT, STATIC_PREFIX) : STATIC_SOUNDS_ROOT;
    await fs.mkdir(storageDir, { recursive: true });
    const target = join(storageDir, `${baseId}.ulaw`);
    if (await fileExists(target)) {
        await ensureNonEmpty(target);
        logger.debug("Reusing existing normalized ulaw", { ulawPath: target });
        return { ulaw: target, id: baseId };
    }
    let task = normalizationTasks.get(baseId);
    if (!task) {
        task = (async () => {
            const tempWav = join(storageDir, `${baseId}.norm.wav`);
            logger.debug("Normalizing audio via sox", { sourceFile, tempWav });
            await normalizeToWav(sourceFile, tempWav);
            logger.debug("Converting normalized WAV to ulaw", { tempWav, target });
            await convertWavToUlaw(tempWav, target);
            await ensureNonEmpty(target);
            await fs.rm(tempWav, { force: true }).catch(() => { });
            const ulawStats = await fs.stat(target).catch(() => null);
            logger.debug("Normalized media ready", {
                ulawPath: target,
                ulawBytes: ulawStats?.size ?? 0,
            });
            return { ulaw: target, id: baseId };
        })()
            .catch((error) => {
            logger.error("Normalization task failed", { hash: baseId, error: error?.message ?? error });
            throw error;
        })
            .finally(() => {
            normalizationTasks.delete(baseId);
        });
        normalizationTasks.set(baseId, task);
    }
    else {
        logger.debug("Waiting for in-flight normalization", { hash: baseId });
    }
    return task;
}
function normalizePrefix(value) {
    if (!value)
        return "";
    const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
    return trimmed.length ? `${trimmed}/` : "";
}
async function ensureMedia(playback) {
    const descriptor = playback.mode === "file"
        ? playback.url
        : hashKey(`${playback.language ?? "en-US"}:${playback.voice ?? "default"}:${playback.text}`);
    logger.debug("Ensuring playback media", { mode: playback.mode, descriptor });
    const file = playback.mode === "file"
        ? await downloadToCache(playback.url)
        : await synthesizeTts(playback.text, playback.voice, playback.language);
    const variants = await ensureNormalizedVariants(file);
    const media = `sound:${variants.id}`;
    logger.debug("Prepared playback media", { mode: playback.mode, descriptor, media });
    return media;
}
const playbackMediaCache = new Map();
function playbackCacheKey(playback) {
    if (playback.mode === "file") {
        const absoluteUrl = resolveMediaUrl(playback.url);
        return `file:${absoluteUrl}`;
    }
    return `tts:${playback.language ?? ""}:${playback.voice ?? ""}:${playback.text}`;
}
function loadPlaybackMedia(playback) {
    const key = playbackCacheKey(playback);
    let task = playbackMediaCache.get(key);
    if (!task) {
        logger.debug("Caching playback media", { key, mode: playback.mode });
        task = ensureMedia(playback).catch((error) => {
            playbackMediaCache.delete(key);
            throw error;
        });
        playbackMediaCache.set(key, task);
    }
    else {
        logger.debug("Reusing cached playback media", { key, mode: playback.mode });
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
            logger.debug("Warming play node media", { nodeId: node.id });
            tasks.push(loadPlaybackMedia(node.playback));
        }
        else if (node.type === "gather" && node.prompt) {
            logger.debug("Warming gather prompt media", { nodeId: node.id });
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
            logger.warn("Panel webhook failed", { event, status: response.status, body, text });
        }
    }
    catch (error) {
        logger.warn("Panel webhook error", { event, error: error?.message ?? error });
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
        logger.debug("Starting channel playback", { channelId: channel.id, media });
        channel.play({ media }, (error, playback) => {
            if (error) {
                logger.warn("Playback start failed", { channelId: channel.id, media, error: error?.message ?? error });
                reject(error);
                return;
            }
            playback.once("PlaybackFinished", () => {
                logger.debug("Playback finished", { channelId: channel.id, media });
                resolve();
            });
            playback.once("PlaybackStopped", () => {
                logger.debug("Playback stopped", { channelId: channel.id, media });
                resolve();
            });
            playback.once("PlaybackFailed", (event) => {
                logger.warn("Playback failed mid-stream", { channelId: channel.id, media, event });
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
    return state;
}
async function handleGather(state, node) {
    const log = sessionLogger(state);
    let attempt = 0;
    while (attempt < node.attempts) {
        log.debug("Starting gather attempt", { nodeId: node.id, attempt: attempt + 1 });
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
            log.debug("Gather received digits", { nodeId: node.id, digits });
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
            log.debug("Gather branching", { nodeId: node.id, digits, next: branch ?? null });
            return branch ?? null;
        }
        log.debug("Gather attempt timed out or insufficient digits", { nodeId: node.id, attempt: attempt + 1 });
        attempt += 1;
    }
    return node.defaultNext ?? null;
}
async function handleDial(state, node) {
    const log = sessionLogger(state);
    const bridgeId = newId("bridge");
    const bridge = client.Bridge();
    const timeoutMs = (node.timeoutSeconds ?? config.dialTimeout) * 1000;
    log.debug("Creating bridge for dial node", { nodeId: node.id, bridgeId });
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
            log.warn("Dial timed out before bridge channel joined", { nodeId: node.id, bridgeId });
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
        log.debug("Originating outbound leg", { nodeId: node.id, endpoint: node.endpoint, callerId, bridgeId });
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
        log.info("Dial node completed", { nodeId: node.id, bridgeId });
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
    const log = sessionLogger(state);
    let current = state.flow.entry;
    while (current !== null && !state.completed) {
        const node = state.nodeMap.get(current);
        if (!node) {
            throw new Error(`Flow node ${current} missing`);
        }
        log.debug("Executing flow node", { nodeId: node.id, type: node.type });
        switch (node.type) {
            case "play": {
                const media = await loadPlaybackMedia(node.playback);
                await playMedia(state.channel, media);
                log.debug("Play node finished", { nodeId: node.id });
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
                log.debug("Gather node finished", { nodeId: node.id, next: current });
                break;
            }
            case "dial": {
                current = await handleDial(state, node);
                log.debug("Dial node finished", { nodeId: node.id, next: current });
                break;
            }
            case "pause": {
                await pause(node.durationSeconds * 1000);
                log.debug("Pause node finished", { nodeId: node.id });
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
                log.info("Hangup node executed", { nodeId: node.id, cause });
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
        logger.debug("Bridge channel arrived with unknown bridge", { sessionId, bridgeId, channelId: channel.id });
        await new Promise((resolve) => {
            channel.hangup({}, () => resolve());
        });
        return;
    }
    logger.debug("Bridge channel joining", { sessionId, bridgeId, channelId: channel.id });
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
    const log = sessionLogger(state);
    log.info("Session started", { channelId: channel.id });
    sessionsByChannel.set(channel.id, state);
    warmFlowMedia(state.flow).catch((error) => {
        logger.warn("Media warmup failed", { sessionId: state.sessionId, error: error?.message ?? error });
    });
    await new Promise((resolve, reject) => {
        channel.answer((error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
    await notifyPanel("call.answered", {
        sessionId: state.sessionId,
        channelId: channel.id,
    });
    log.info("Channel answered", { channelId: channel.id });
    try {
        await runFlow(state);
    }
    catch (error) {
        log.error("Flow execution failed", { error: error?.message ?? error });
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
        logger.debug("DTMF digit received", {
            sessionId: state.sessionId,
            digit: event.digit,
            collected: state.gather.input,
            maxDigits: state.gather.node.maxDigits,
        });
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
            logger.debug("Bridge channel destroyed", { bridgeId: bridgeEntry.id, channelId: event.channel.id });
            bridgeEntry.resolve();
        }
        return;
    }
    const log = sessionLogger(state);
    sessionsByChannel.delete(event.channel.id);
    if (!state.completionSent) {
        state.completionSent = true;
        const duration = Math.max(0, Math.round((Date.now() - state.startedAt) / 1000));
        await notifyPanel("call.completed", {
            sessionId: state.sessionId,
            durationSeconds: duration,
            dtmf: state.digits.length > 0 ? state.digits : undefined,
        });
        log.info("Session completed", { durationSeconds: duration, digits: state.digits });
    }
}
export async function startFlowRunner() {
    if (client)
        return;
    logger.info("Starting flow runner", { ariBaseUrl: config.ariBaseUrl, application: config.ariApplication });
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
            logger.error("StasisStart handler error", { error: error?.message ?? error });
        }
    });
    client.on("StasisEnd", async (event) => {
        try {
            await handleStasisEnd(event);
        }
        catch (error) {
            logger.error("StasisEnd handler error", { error: error?.message ?? error });
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
            logger.error("DTMF handler error", { error: error?.message ?? error });
        }
    });
    client.start(config.ariApplication);
    logger.info("Flow runner ready", { application: config.ariApplication });
}
