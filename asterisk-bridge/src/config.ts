import dotenv from "dotenv";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";

dotenv.config();

function expandEnv(value: string) {
  return value.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name]?.trim() ?? "");
}

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing environment variable ${key}`);
  }
  return expandEnv(value.trim());
}

function optionalEnv(key: string) {
  const value = process.env[key];
  if (!value || value.trim().length === 0) return undefined;
  return expandEnv(value.trim());
}

function ensureDir(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

const httpPort = Number.parseInt(optionalEnv("HTTP_PORT") ?? "4000", 10);
const ringTimeout = Number.parseInt(optionalEnv("DEFAULT_RING_TIMEOUT") ?? "45", 10);
const dialTimeout = Number.parseInt(optionalEnv("DEFAULT_DIAL_TIMEOUT") ?? "30", 10);

const panelBaseUrl = requireEnv("PANEL_BASE_URL").replace(/\/$/, "");
const panelWebhookUrl = requireEnv("PANEL_WEBHOOK_URL");
const ariBaseUrl = requireEnv("ARI_BASE_URL").replace(/\/$/, "");
const pjsipDir = resolve(requireEnv("ASTERISK_PJSIP_DIR"));
const soundsDir = resolve(requireEnv("ASTERISK_SOUNDS_DIR"));
const cacheDir = resolve(optionalEnv("SOUNDS_CACHE_DIR") ?? soundsDir);
const soundsRoot = resolve(soundsDir, "..");
ensureDir(pjsipDir);
ensureDir(soundsDir);
ensureDir(cacheDir);

export const config = {
  httpPort,
  bridgeToken: requireEnv("BRIDGE_TOKEN"),
  panelBaseUrl,
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
  ttsProvider: optionalEnv("TTS_PROVIDER") ?? "pico",
  ringTimeout,
  dialTimeout,
  logLevel: optionalEnv("LOG_LEVEL") ?? "info",
};
