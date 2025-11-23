import { config } from "./config.js";
const levelWeights = {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    trace: 5,
    silent: 10,
};
function normalizeLevel(value) {
    if (!value)
        return "info";
    const lower = value.toLowerCase();
    if (levelWeights[lower] === undefined) {
        return "info";
    }
    return lower;
}
const activeLevel = normalizeLevel(config.logLevel);
function shouldLog(level) {
    if (activeLevel === "silent")
        return false;
    return levelWeights[level] <= levelWeights[activeLevel];
}
function emit(level, message, context) {
    if (!shouldLog(level))
        return;
    const payload = {
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
    }
    else if (level === "warn") {
        console.warn(line);
    }
    else if (level === "info") {
        console.info(line);
    }
    else {
        console.debug(line);
    }
}
function createLogger(baseContext = {}) {
    const merge = (context) => (context ? { ...baseContext, ...context } : baseContext);
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
