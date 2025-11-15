import AriClient from "ari-client";
import { promises as fs } from "fs";
import { join, relative } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { config } from "./config";
import { hashKey, newId } from "./utils";
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
async function ensureMedia(playback) {
    const file = playback.mode === "file"
        ? await downloadToCache(playback.url)
        : await synthesizeTts(playback.text, playback.voice, playback.language);
    const relativePath = relative(config.soundsRoot, file).replace(/\\/g, "/");
    const withoutExtension = relativePath.replace(/\.[^/.]+$/, "");
    return `sound:${withoutExtension}`;
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
    let attempt = 0;
    while (attempt < node.attempts) {
        if (node.prompt) {
            const media = await ensureMedia(node.prompt);
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
            const branch = node.branches[digits] ?? node.defaultNext;
            return branch ?? null;
        }
        attempt += 1;
    }
    return node.defaultNext ?? null;
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
                const media = await ensureMedia(node.playback);
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
                await new Promise((resolve, reject) => {
                    state.channel.hangup({ reason: node.reason ?? "completed" }, (error) => {
                        if (error)
                            reject(error);
                        else
                            resolve();
                    });
                });
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
    client.start(config.ariApplication);
}
