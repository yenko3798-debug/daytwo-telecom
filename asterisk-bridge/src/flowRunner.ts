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
let staticDirsReady: Promise<void> | null = null;
const normalizationTasks = new Map<string, Promise<{
  ulaw: string;
  id: string;
}>>();
const SOX_BIN = process.env.SOX_BIN || "/usr/bin/sox";
const FFMPEG_BIN = process.env.FFMPEG_BIN || "/usr/bin/ffmpeg";

function ensureStaticDirs() {
  if (!staticDirsReady) {
    staticDirsReady = (async () => {
      await fs.mkdir(STATIC_CACHE_DIR, { recursive: true }).catch(() => {});
      const soundsDir = STATIC_PREFIX.length ? join(STATIC_SOUNDS_ROOT, STATIC_PREFIX) : STATIC_SOUNDS_ROOT;
      await fs.mkdir(soundsDir, { recursive: true }).catch(() => {});
    })();
  }
  return staticDirsReady;
}

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
  reason?: string | number;
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

function sessionLogger(state: SessionState) {
  return logger.child({ sessionId: state.sessionId });
}

function isPrivateHostname(hostname: string) {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") return true;
  if (lower.endsWith(".local")) return true;
  if (lower.startsWith("10.")) return true;
  if (lower.startsWith("192.168.")) return true;
  if (lower.startsWith("169.254.")) return true;
  const match172 = lower.match(/^172\.(\d+)\./);
  if (match172) {
    const value = Number(match172[1]);
    if (value >= 16 && value <= 31) return true;
  }
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

function buildMediaBaseUrl(path: string) {
  return new URL(path, `${config.mediaBaseUrl}/`).toString();
}

function resolveMediaUrl(raw: string) {
  if (!raw || raw.trim().length === 0) {
    throw new Error("Playback URL is missing");
  }
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) {
    const parsed = new URL(value);
    if (
      isPrivateHostname(parsed.hostname) &&
      !isPrivateHostname(new URL(config.mediaBaseUrl).hostname)
    ) {
      return buildMediaBaseUrl(parsed.pathname + parsed.search + parsed.hash);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Playback files must be served over HTTP or HTTPS");
    }
    return parsed.toString();
  }
  return buildMediaBaseUrl(value);
}

function mediaBaseId(file: string) {
  return basename(file).replace(/\.[^/.]+$/, "");
}

async function ensureNonEmpty(file: string) {
  const stats = await fs.stat(file);
  if (!stats.isFile() || stats.size < 200) {
    throw new Error("Normalized audio has no content");
  }
}

async function downloadToCache(url: string) {
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
  } catch {
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

async function synthesizeTts(text: string, voice?: string, language?: string) {
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
  } catch {
    const languageCode = language ?? "en-US";
    logger.debug("Synthesizing TTS prompt", { file, voice, language: languageCode, chars: text.length });
    await execFileAsync("pico2wave", ["-l", languageCode, "-w", file, text]);
    return file;
  }
}

async function tryTranscode(command: string, args: string[], label: string) {
  try {
    await execFileAsync(command, args);
    return true;
  } catch (error: any) {
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

async function fileExists(path: string) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function normalizeToWav(input: string, output: string) {
  const tmp = `${output}.tmp.wav`;
  await fs.rm(tmp, { force: true }).catch(() => {});
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

async function convertWavToUlaw(input: string, output: string) {
  const tmp = `${output}.tmp.wav`;
  await fs.rm(tmp, { force: true }).catch(() => {});
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

async function ensureNormalizedVariants(sourceFile: string) {
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
      await fs.rm(tempWav, { force: true }).catch(() => {});
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
  } else {
    logger.debug("Waiting for in-flight normalization", { hash: baseId });
  }

  return task;
}

function normalizePrefix(value?: string) {
  if (!value) return "";
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed.length ? `${trimmed}/` : "";
}

async function ensureMedia(playback: Playback) {
  const descriptor =
    playback.mode === "file"
      ? playback.url
      : hashKey(`${playback.language ?? "en-US"}:${playback.voice ?? "default"}:${playback.text}`);
  logger.debug("Ensuring playback media", { mode: playback.mode, descriptor });
  const file =
    playback.mode === "file"
      ? await downloadToCache(playback.url)
      : await synthesizeTts(playback.text, playback.voice, playback.language);
  const variants = await ensureNormalizedVariants(file);
  const media = `sound:${variants.id}`;
  logger.debug("Prepared playback media", { mode: playback.mode, descriptor, media });
  return media;
}

const playbackMediaCache = new Map<string, Promise<string>>();

class ChannelGoneError extends Error {
  code: string;
  constructor(message: string) {
    super(message);
    this.name = "ChannelGoneError";
    this.code = "CHANNEL_GONE";
  }
}

function normalizeErrorMessage(error: any) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error.message === "string") return error.message;
  if (typeof error.reason === "string") return error.reason;
  if (typeof error.cause === "string") return error.cause;
  return String(error);
}

function matchesChannelGone(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("channel not found") ||
    lower.includes("no such channel") ||
    lower.includes("channel is dead") ||
    lower.includes("hung up") ||
    lower === "hangup"
  );
}

function asChannelGoneError(error: any, fallback?: string) {
  if (error instanceof ChannelGoneError) return error;
  const message = normalizeErrorMessage(error) || fallback;
  if (message && matchesChannelGone(message)) {
    return new ChannelGoneError(message);
  }
  return null;
}

function isChannelGoneError(error: any): error is ChannelGoneError {
  if (!error) return false;
  if (error instanceof ChannelGoneError) return true;
  return error.code === "CHANNEL_GONE" || matchesChannelGone(normalizeErrorMessage(error));
}

function playbackCacheKey(playback: Playback) {
  if (playback.mode === "file") {
    const absoluteUrl = resolveMediaUrl(playback.url);
    return `file:${absoluteUrl}`;
  }
  return `tts:${playback.language ?? ""}:${playback.voice ?? ""}:${playback.text}`;
}

function loadPlaybackMedia(playback: Playback) {
  const key = playbackCacheKey(playback);
  let task = playbackMediaCache.get(key);
  if (!task) {
    logger.debug("Caching playback media", { key, mode: playback.mode });
    task = ensureMedia(playback).catch((error) => {
      playbackMediaCache.delete(key);
      throw error;
    });
    playbackMediaCache.set(key, task);
  } else {
    logger.debug("Reusing cached playback media", { key, mode: playback.mode });
  }
  return task;
}

function normalizeHangupCause(reason?: string | number) {
  if (typeof reason === "number" && Number.isFinite(reason)) {
    return reason;
  }
  if (typeof reason === "string") {
    const value = reason.trim().toLowerCase();
    if (!value) {
      return undefined;
    }
    const mapped: Record<string, number> = {
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

async function answerChannel(channel: any) {
  return new Promise<void>((resolve, reject) => {
    channel.answer((error: any) => {
      if (error) {
        reject(asChannelGoneError(error) ?? error);
      } else {
        resolve();
      }
    });
  });
}

async function addChannelToBridge(bridge: any, channelId: string) {
  return new Promise<void>((resolve, reject) => {
    bridge.addChannel({ channel: channelId }, (error: any) => {
      if (error) {
        reject(asChannelGoneError(error) ?? error);
      } else {
        resolve();
      }
    });
  });
}

async function hangupChannel(channel: any, params: Record<string, any> = {}) {
  await new Promise<void>((resolve) => {
    channel.hangup(params, () => resolve());
  }).catch(() => {});
}

async function warmFlowMedia(flow: FlowDefinition) {
  const tasks: Promise<string>[] = [];
  for (const node of flow.nodes) {
    if (node.type === "play") {
      logger.debug("Warming play node media", { nodeId: node.id });
      tasks.push(loadPlaybackMedia(node.playback));
    } else if (node.type === "gather" && node.prompt) {
      logger.debug("Warming gather prompt media", { nodeId: node.id });
      tasks.push(loadPlaybackMedia(node.prompt));
    }
  }
  await Promise.allSettled(tasks);
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
      logger.warn("Panel webhook failed", { event, status: response.status, body, text });
    }
  } catch (error: any) {
    logger.warn("Panel webhook error", { event, error: error?.message ?? error });
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
    logger.debug("Starting channel playback", { channelId: channel.id, media });
    channel.play({ media }, (error: any, playback: any) => {
      if (error) {
        const gone = asChannelGoneError(error);
        if (gone) {
          logger.info("Playback aborted due to missing channel", {
            channelId: channel.id,
            media,
            error: gone.message,
          });
          reject(gone);
        } else {
          logger.warn("Playback start failed", { channelId: channel.id, media, error: error?.message ?? error });
          reject(error);
        }
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
      playback.once("PlaybackFailed", (event: any) => {
        const cause = event?.cause ?? event?.message;
        const gone = asChannelGoneError(cause);
        if (gone) {
          logger.info("Playback stopped because channel went away", {
            channelId: channel.id,
            media,
            cause,
          });
          reject(gone);
          return;
        }
        logger.warn("Playback failed mid-stream", { channelId: channel.id, media, event });
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
  const log = sessionLogger(state);
  let attempt = 0;
  while (attempt < node.attempts) {
    log.debug("Starting gather attempt", { nodeId: node.id, attempt: attempt + 1 });
    if (node.prompt) {
      const media = await loadPlaybackMedia(node.prompt);
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

async function handleDial(state: SessionState, node: DialNode): Promise<string | null> {
  const log = sessionLogger(state);
  const bridgeId = newId("bridge");
  const bridge = client.Bridge();
  const timeoutMs = (node.timeoutSeconds ?? config.dialTimeout) * 1000;
  log.debug("Creating bridge for dial node", { nodeId: node.id, bridgeId });
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
      log.warn("Dial timed out before bridge channel joined", { nodeId: node.id, bridgeId });
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
    log.debug("Originating outbound leg", { nodeId: node.id, endpoint: node.endpoint, callerId, bridgeId });
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
    log.info("Dial node completed", { nodeId: node.id, bridgeId });
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
  const log = sessionLogger(state);
  let current: string | null = state.flow.entry;
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
        await new Promise<void>((resolve) => {
          state.channel.hangup(params, () => resolve());
        }).catch(() => {});
        log.info("Hangup node executed", { nodeId: node.id, cause });
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
    logger.debug("Bridge channel arrived with unknown bridge", { sessionId, bridgeId, channelId: channel.id });
    await hangupChannel(channel);
    return;
  }
  logger.debug("Bridge channel joining", { sessionId, bridgeId, channelId: channel.id });
  bridgeState.channelId = channel.id;
  try {
    await answerChannel(channel);
    await addChannelToBridge(bridgeState.bridge, channel.id);
  } catch (error: any) {
    if (isChannelGoneError(error)) {
      logger.info("Bridge channel ended before joining", {
        sessionId,
        bridgeId,
        channelId: channel.id,
        reason: normalizeErrorMessage(error),
      });
    } else {
      logger.warn("Bridge channel failed to join", {
        sessionId,
        bridgeId,
        channelId: channel.id,
        error: error?.message ?? error,
      });
    }
    bridgeState.reject(error);
    await hangupChannel(channel);
  }
}

async function handleSessionStart(event: any, channel: any) {
  const sessionId = event.args[2];
  const payload = await fetchSession(sessionId);
  const state = createSessionState(payload, channel);
  const log = sessionLogger(state);
  log.info("Session started", { channelId: channel.id });
  sessionsByChannel.set(channel.id, state);
  warmFlowMedia(state.flow).catch((error: any) => {
    logger.warn("Media warmup failed", { sessionId: state.sessionId, error: error?.message ?? error });
  });
  try {
    await answerChannel(channel);
  } catch (error: any) {
    sessionsByChannel.delete(channel.id);
    if (isChannelGoneError(error)) {
      log.info("Channel ended before answer", { reason: normalizeErrorMessage(error) });
      state.completed = true;
      state.completionSent = true;
      await notifyPanel("call.hungup", {
        sessionId: state.sessionId,
        channelId: channel.id,
        reason: normalizeErrorMessage(error) || "Channel not found",
      });
      return;
    }
    throw error;
  }
  await notifyPanel("call.answered", {
    sessionId: state.sessionId,
    channelId: channel.id,
  });
  log.info("Channel answered", { channelId: channel.id });
  try {
    await runFlow(state);
  } catch (error: any) {
    const reason = normalizeErrorMessage(error) || "Flow execution failed";
    if (isChannelGoneError(error)) {
      log.info("Channel ended during flow", { reason });
      state.completed = true;
      state.completionSent = true;
      await notifyPanel("call.hungup", {
        sessionId: state.sessionId,
        channelId: state.channelId,
        reason,
      });
    } else {
      log.error("Flow execution failed", { error: error?.message ?? error });
      await notifyPanel("call.failed", {
        sessionId: state.sessionId,
        channelId: state.channelId,
        error: error?.message ?? String(error),
      });
      state.completed = true;
      state.completionSent = true;
    }
    sessionsByChannel.delete(channel.id);
    await hangupChannel(channel);
  }
}

function handleDtmf(event: any) {
  const state = sessionsByChannel.get(event.channel.id);
  if (!state) return;
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

async function handleStasisEnd(event: any) {
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
  if (client) return;
  logger.info("Starting flow runner", { ariBaseUrl: config.ariBaseUrl, application: config.ariApplication });
  client = await AriClient.connect(config.ariBaseUrl, config.ariUsername, config.ariPassword);
  client.on("StasisStart", async (event: any, channel: any) => {
    try {
      if (event.args && event.args[0] === "bridge") {
        await handleBridgeStart(event, channel);
      } else {
        await handleSessionStart(event, channel);
      }
    } catch (error: any) {
      logger.error("StasisStart handler error", { error: error?.message ?? error });
    }
  });
  client.on("StasisEnd", async (event: any) => {
    try {
      await handleStasisEnd(event);
    } catch (error: any) {
      logger.error("StasisEnd handler error", { error: error?.message ?? error });
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
      logger.error("DTMF handler error", { error: error?.message ?? error });
    }
  });
  client.start(config.ariApplication);
  logger.info("Flow runner ready", { application: config.ariApplication });
}
