import AriClient from "ari-client";
import { promises as fs } from "fs";
import { join, relative } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { config } from "./config.js";
import { hashKey, newId } from "./utils.js";

const execFileAsync = promisify(execFile);

type PlaybackTts = {
  mode: "tts";
  text: string;
  voice?: string;
  language?: string;
  engine?: string;
};

type PlaybackFile = {
  mode: "file";
  url: string;
  mimeType?: string;
  durationSeconds?: number;
};

type Playback = PlaybackTts | PlaybackFile;

type FlowNodeBase = {
  id: string;
  name?: string;
  description?: string;
};

type PlayNode = FlowNodeBase & {
  type: "play";
  playback: Playback;
  next?: string;
};

type GatherNode = FlowNodeBase & {
  type: "gather";
  prompt?: Playback;
  maxDigits: number;
  minDigits: number;
  timeoutSeconds: number;
  attempts: number;
  variable: string;
  branches: Record<string, string>;
  defaultNext?: string;
};

type DialNode = FlowNodeBase & {
  type: "dial";
  endpoint: string;
  callerId?: string;
  timeoutSeconds?: number;
  next?: string;
};

type PauseNode = FlowNodeBase & {
  type: "pause";
  durationSeconds: number;
  next?: string;
};

type HangupNode = FlowNodeBase & {
  type: "hangup";
  reason?: string;
};

type FlowNode = PlayNode | GatherNode | DialNode | PauseNode | HangupNode;

type FlowDefinition = {
  name: string;
  version?: string;
  entry: string;
  metadata?: Record<string, any>;
  nodes: FlowNode[];
};

type SessionPayload = {
  session: {
    id: string;
    status: string;
    callerId: string;
    dialedNumber: string;
    metadata: Record<string, any> | null;
  };
  campaign: {
    id: string;
    name: string;
    metadata: Record<string, any> | null;
  };
  lead: {
    id: string;
    phoneNumber: string;
    normalizedNumber: string | null;
    metadata: Record<string, any> | null;
  };
  route: Record<string, any>;
  flow: {
    id: string;
    version: string | null;
    summary: Record<string, any> | null;
    definition: FlowDefinition;
  } | null;
  rate: Record<string, any> | null;
};

type GatherState = {
  node: GatherNode;
  input: string;
  resolve: (digits: string) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  attempts: number;
};

type BridgeState = {
  id: string;
  sessionId: string;
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  bridge: any;
  channelId?: string;
};

type SessionState = {
  sessionId: string;
  channelId: string;
  channel: any;
  payload: SessionPayload;
  flow: FlowDefinition;
  nodeMap: Map<string, FlowNode>;
  startedAt: number;
  digits: string;
  gather?: GatherState;
  bridge?: BridgeState;
  variables: Record<string, string>;
  completed: boolean;
  completionSent: boolean;
};

let client: any;
const sessionsByChannel = new Map<string, SessionState>();
const bridges = new Map<string, BridgeState>();

async function downloadToCache(url: string) {
  const key = hashKey(url);
  const extensionMatch = url.match(/\.(wav|ulaw|sln16|gsm|mp3|ogg)(\?.*)?$/i);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "wav";
  const file = join(config.cacheDir, `${key}.${extension}`);
  try {
    await fs.access(file);
    return file;
  } catch {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to download media ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(file, Buffer.from(arrayBuffer));
    return file;
  }
}

async function synthesizeTts(text: string, voice?: string, language?: string) {
  if (config.ttsProvider !== "pico") {
    throw new Error("Unsupported TTS provider");
  }
  const key = hashKey(`${language ?? "en-US"}:${voice ?? "default"}:${text}`);
  const file = join(config.cacheDir, `${key}.wav`);
  try {
    await fs.access(file);
    return file;
  } catch {
    const languageCode = language ?? "en-US";
    await execFileAsync("pico2wave", ["-l", languageCode, "-w", file, text]);
    return file;
  }
}

async function tryTranscode(command: string, args: string[]) {
  try {
    await execFileAsync(command, args);
    return true;
  } catch {
    return false;
  }
}

async function fileExists(path: string) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function normalizeToWav(input: string, output: string) {
  const tmp = `${output}.tmp`;
  await fs.rm(tmp, { force: true }).catch(() => {});
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

async function convertWavToUlaw(input: string, output: string) {
  const tmp = `${output}.tmp`;
  await fs.rm(tmp, { force: true }).catch(() => {});
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

async function ensureNormalizedVariants(file: string) {
  const base = file.replace(/\.[^/.]+$/, "");
  const wavPath = `${base}.wav`;
  const ulawPath = `${base}.ulaw`;
  if (!(await fileExists(wavPath))) {
    await normalizeToWav(file, wavPath);
  }
  if (!(await fileExists(ulawPath))) {
    await convertWavToUlaw(wavPath, ulawPath);
  }
  return { wav: wavPath, ulaw: ulawPath };
}

function normalizePrefix(value?: string) {
  if (!value) return "";
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed.length ? `${trimmed}/` : "";
}

async function ensureMedia(playback: Playback) {
  const file =
    playback.mode === "file"
      ? await downloadToCache(playback.url)
      : await synthesizeTts(playback.text, playback.voice, playback.language);
  const variants = await ensureNormalizedVariants(file);
  const chosen = config.soundExtension?.toLowerCase() === "wav" ? variants.wav : variants.ulaw;
  const relativePath = relative(config.soundsRoot, chosen).replace(/\\/g, "/");
  const withoutExtension = relativePath.replace(/\.[^/.]+$/, "");
  const prefix = normalizePrefix(config.soundPrefix);
  const suffix = config.soundExtension ? `.${config.soundExtension.replace(/^\./, "")}` : "";
  const defaultExt = config.soundExtension
    ? ""
    : chosen.endsWith(".wav")
    ? ".wav"
    : ".ulaw";
  return `sound:${prefix}${withoutExtension}${suffix || defaultExt}`;
}

async function notifyPanel(event: string, body: Record<string, any>) {
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
  } catch (error: any) {
    console.error(`Webhook ${event} error: ${error?.message ?? error}`);
  }
}

async function fetchSession(sessionId: string) {
  const response = await fetch(`${config.panelBaseUrl}/api/ari/sessions/${sessionId}`, {
    headers: {
      "x-ari-token": config.panelAriToken,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Session lookup failed: ${text}`);
  }
  return (await response.json()) as SessionPayload;
}

async function playMedia(channel: any, media: string) {
  return new Promise<void>((resolve, reject) => {
    channel.play({ media }, (error: any, playback: any) => {
      if (error) {
        reject(error);
        return;
      }
      playback.once("PlaybackFinished", () => resolve());
      playback.once("PlaybackStopped", () => resolve());
      playback.once("PlaybackFailed", (event: any) => {
        reject(new Error(event?.cause ?? "Playback failed"));
      });
    });
  });
}

async function pause(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function createSessionState(payload: SessionPayload, channel: any) {
  if (!payload.flow) {
    throw new Error("Flow definition missing");
  }
  const flow = payload.flow.definition;
  const nodeMap = new Map<string, FlowNode>();
  flow.nodes.forEach((node) => nodeMap.set(node.id, node));
  if (!nodeMap.has(flow.entry)) {
    throw new Error(`Flow entry node ${flow.entry} missing`);
  }
  const state: SessionState = {
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

async function handleGather(state: SessionState, node: GatherNode): Promise<string | null> {
  let attempt = 0;
  while (attempt < node.attempts) {
    if (node.prompt) {
      const media = await ensureMedia(node.prompt);
      await playMedia(state.channel, media);
    }
    const digits = await new Promise<string>((resolve, reject) => {
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

async function handleDial(state: SessionState, node: DialNode): Promise<string | null> {
  const bridgeId = newId("bridge");
  const bridge = client.Bridge();
  const timeoutMs = (node.timeoutSeconds ?? config.dialTimeout) * 1000;
  await new Promise<void>((resolve, reject) => {
    bridge.create({ type: "mixing", bridgeId }, (error: any) => {
      if (error) reject(error);
      else resolve();
    });
  });
  await new Promise<void>((resolve, reject) => {
    bridge.addChannel({ channel: state.channel.id }, (error: any) => {
      if (error) reject(error);
      else resolve();
    });
  });
  const dialPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      bridges.delete(bridgeId);
      reject(new Error("Dial timed out"));
    }, timeoutMs);
    const bridgeState: BridgeState = {
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
    await new Promise<void>((resolve, reject) => {
      client.channels.originate(
        {
          endpoint: node.endpoint,
          app: config.ariApplication,
          appArgs,
          callerId,
          timeout: node.timeoutSeconds ?? config.dialTimeout,
        },
        (error: any) => {
          if (error) reject(error);
          else resolve();
        }
      );
    });
    await dialPromise;
  } finally {
    bridges.delete(bridgeId);
    await new Promise<void>((resolve, reject) => {
      bridge.destroy((error: any) => {
        if (error) reject(error);
        else resolve();
      });
    }).catch(() => {});
  }
  return node.next ?? null;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported node ${(value as FlowNode).type}`);
}

async function runFlow(state: SessionState) {
  let current: string | null = state.flow.entry;
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
        await new Promise<void>((resolve, reject) => {
          state.channel.hangup({ reason: node.reason ?? "completed" }, (error: any) => {
            if (error) reject(error);
            else resolve();
          });
        });
        return;
      }
      default:
        assertNever(node);
    }
  }
}

async function handleBridgeStart(event: any, channel: any) {
  const sessionId = event.args[1];
  const bridgeId = event.args[2];
  const bridgeState = bridges.get(bridgeId);
  if (!bridgeState) {
    await new Promise<void>((resolve) => {
      channel.hangup({}, () => resolve());
    });
    return;
  }
  bridgeState.channelId = channel.id;
  await new Promise<void>((resolve, reject) => {
    channel.answer((error: any) => {
      if (error) reject(error);
      else resolve();
    });
  });
  await new Promise<void>((resolve, reject) => {
    bridgeState.bridge.addChannel({ channel: channel.id }, (error: any) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function handleSessionStart(event: any, channel: any) {
  const sessionId = event.args[2];
  const payload = await fetchSession(sessionId);
  const state = createSessionState(payload, channel);
  sessionsByChannel.set(channel.id, state);
  await new Promise<void>((resolve, reject) => {
    channel.answer((error: any) => {
      if (error) reject(error);
      else resolve();
    });
  });
  await notifyPanel("call.answered", {
    sessionId: state.sessionId,
    channelId: channel.id,
  });
  try {
    await runFlow(state);
  } catch (error: any) {
    await notifyPanel("call.failed", {
      sessionId: state.sessionId,
      error: error?.message ?? String(error),
    });
    sessionsByChannel.delete(channel.id);
    await new Promise<void>((resolve) => {
      channel.hangup({}, () => resolve());
    });
  }
}

function handleDtmf(event: any) {
  const state = sessionsByChannel.get(event.channel.id);
  if (!state) return;
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

async function handleStasisEnd(event: any) {
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
  if (client) return;
  client = await AriClient.connect(config.ariBaseUrl, config.ariUsername, config.ariPassword);
  client.on("StasisStart", async (event: any, channel: any) => {
    try {
      if (event.args && event.args[0] === "bridge") {
        await handleBridgeStart(event, channel);
      } else {
        await handleSessionStart(event, channel);
      }
    } catch (error: any) {
      console.error(`StasisStart error: ${error?.message ?? error}`);
    }
  });
  client.on("StasisEnd", async (event: any) => {
    try {
      await handleStasisEnd(event);
    } catch (error: any) {
      console.error(`StasisEnd error: ${error?.message ?? error}`);
    }
  });
  client.on("ChannelDestroyed", (event: any) => {
    const bridgeEntry = Array.from(bridges.values()).find((b) => b.channelId === event.channel.id);
    if (bridgeEntry) {
      bridgeEntry.resolve();
    }
  });
  client.on("ChannelDtmfReceived", (event: any) => {
    try {
      handleDtmf(event);
    } catch (error: any) {
      console.error(`DTMF handler error: ${error?.message ?? error}`);
    }
  });
  client.start(config.ariApplication);
}
