import { config } from "./config.js";

type Level = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

const levelWeights: Record<Level, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
  silent: 10,
};

type Context = Record<string, any>;

function normalizeLevel(value: string | undefined): Level {
  if (!value) return "info";
  const lower = value.toLowerCase() as Level;
  if (levelWeights[lower] === undefined) {
    return "info";
  }
  return lower;
}

const activeLevel = normalizeLevel(config.logLevel);

function shouldLog(level: Level) {
  if (activeLevel === "silent") return false;
  return levelWeights[level] <= levelWeights[activeLevel];
}

function emit(level: Exclude<Level, "silent">, message: string, context?: Context) {
  if (!shouldLog(level)) return;
  const payload: Record<string, any> = {
    level,
    time: new Date().toISOString(),
    message,
  };
  if (context && Object.keys(context).length > 0) {
    payload.context = context;
  }
  const line = JSON.stringify(payload);
  if (level === "fatal" || level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (level === "info") {
    console.info(line);
  } else {
    console.debug(line);
  }
}

type LoggerMethods = {
  fatal: (message: string, context?: Context) => void;
  error: (message: string, context?: Context) => void;
  warn: (message: string, context?: Context) => void;
  info: (message: string, context?: Context) => void;
  debug: (message: string, context?: Context) => void;
  trace: (message: string, context?: Context) => void;
  child: (context: Context) => LoggerMethods;
};

function createLogger(baseContext: Context = {}): LoggerMethods {
  const merge = (context?: Context) => (context ? { ...baseContext, ...context } : baseContext);
  return {
    fatal: (message, context) => emit("fatal", message, merge(context)),
    error: (message, context) => emit("error", message, merge(context)),
    warn: (message, context) => emit("warn", message, merge(context)),
    info: (message, context) => emit("info", message, merge(context)),
    debug: (message, context) => emit("debug", message, merge(context)),
    trace: (message, context) => emit("trace", message, merge(context)),
    child: (context) => createLogger({ ...baseContext, ...context }),
  };
}

export const logger = createLogger();
