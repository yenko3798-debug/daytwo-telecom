import { createHash } from "crypto";
import { SipRoute } from "@prisma/client";

type AriConfig = {
  baseUrl: string;
  username: string;
  password: string;
  application?: string;
  context?: string;
  extension?: string;
  priority?: number;
};

type OriginateOptions = {
  route: Pick<
    SipRoute,
    | "id"
    | "domain"
    | "outboundUri"
    | "trunkPrefix"
    | "callerIdFormat"
    | "metadata"
  >;
  dialString: string;
  callerId: string;
  timeoutSeconds: number;
  variables?: Record<string, string>;
  appArgs?: string[];
};

export type OriginateResult = {
  channelId: string | null;
  payload: any;
};

const bridgeConfigured =
  Boolean(process.env.ASTERISK_BRIDGE_URL) &&
  Boolean(process.env.ASTERISK_BRIDGE_TOKEN);

function bridgeConfig() {
  const baseUrl = process.env.ASTERISK_BRIDGE_URL?.replace(/\/$/, "");
  const token = process.env.ASTERISK_BRIDGE_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("Asterisk bridge is not configured");
  }
  return { baseUrl, token };
}

function sanitizeRouteId(id: string) {
  const normalized = id.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.length > 0) return normalized;
  return createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function metadataTemplate(route: OriginateOptions["route"]) {
  if (!route.metadata || typeof route.metadata !== "object" || Array.isArray(route.metadata)) {
    return undefined;
  }
  const template = (route.metadata as Record<string, any>).dialEndpoint;
  if (typeof template === "string" && template.length > 0) {
    return template;
  }
  return undefined;
}

function readConfig(): AriConfig {
  const baseUrl = process.env.ARI_BASE_URL?.replace(/\/$/, "");
  const username = process.env.ARI_USERNAME;
  const password = process.env.ARI_PASSWORD;
  if (!baseUrl || !username || !password) {
    throw new Error("ARI configuration is incomplete");
  }
  const application = process.env.ARI_APPLICATION || undefined;
  const context = process.env.ARI_CONTEXT || undefined;
  const extension = process.env.ARI_EXTENSION || undefined;
  if (!application && (!context || !extension)) {
    throw new Error("ARI_APPLICATION or both ARI_CONTEXT and ARI_EXTENSION must be set");
  }
  if ((context && !extension) || (!context && extension)) {
    throw new Error("Both ARI_CONTEXT and ARI_EXTENSION must be provided together");
  }
  const priorityRaw = process.env.ARI_PRIORITY;
  const priorityValue = priorityRaw ? Number.parseInt(priorityRaw, 10) : undefined;
  const priority = Number.isFinite(priorityValue) && priorityValue && priorityValue > 0 ? priorityValue : undefined;
  return {
    baseUrl,
    username,
    password,
    application,
    context,
    extension,
    priority,
  };
}

function buildEndpoint(route: OriginateOptions["route"], dialString: string) {
  const template = renderTemplate(metadataTemplate(route) ?? route.outboundUri ?? null, dialString);
  if (template) {
    return template;
  }
  if (route.domain.includes("/")) {
    return `${route.domain}${dialString}`;
  }
  if (bridgeConfigured) {
    const safeId = sanitizeRouteId(route.id);
    return `PJSIP/bridge-${safeId}/${dialString}`;
  }
  return `SIP/${dialString}@${route.domain}`;
}

function renderTemplate(template: string | null | undefined, dialString: string) {
  if (!template) return null;
  const replaced = template.includes("{number}") ? template.replaceAll("{number}", dialString) : template;
  const normalized = replaced.trim();
  if (!normalized) return null;
  const looksLikeChannel = /^[A-Za-z0-9]+\/.+/.test(normalized);
  const looksLikeUri = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized) || normalized.includes("@");
  if (looksLikeChannel || looksLikeUri) {
    return normalized;
  }
  return null;
}

async function originateViaBridge(opts: OriginateOptions): Promise<OriginateResult> {
  const cfg = bridgeConfig();
  const response = await fetch(`${cfg.baseUrl}/api/calls`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-bridge-token": cfg.token,
    },
    body: JSON.stringify({
      route: opts.route,
      dialString: opts.dialString,
      callerId: opts.callerId,
      timeoutSeconds: opts.timeoutSeconds,
      variables: opts.variables,
      appArgs: opts.appArgs,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Bridge originate failed (${response.status}): ${text}`);
  }
  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const channelId = payload?.channelId ?? payload?.id ?? null;
  return { channelId, payload };
}

async function originateViaAri(opts: OriginateOptions): Promise<OriginateResult> {
  const config = readConfig();
  const endpoint = buildEndpoint(opts.route, opts.dialString);
  const params = new URLSearchParams();
  params.set("endpoint", endpoint);
  params.set("callerId", opts.callerId);
  params.set("timeout", String(Math.max(5, opts.timeoutSeconds)));
  if (config.application) {
    params.set("app", config.application);
  }
  if (config.context && config.extension) {
    params.set("context", config.context);
    params.set("extension", config.extension);
    params.set("priority", String(config.priority ?? 1));
  }
  if (opts.variables) {
    for (const [key, value] of Object.entries(opts.variables)) {
      params.append("variables", `${key}=${value}`);
    }
  }
  if (opts.appArgs?.length) {
    params.set("appArgs", opts.appArgs.join(","));
  }

  const auth = Buffer.from(`${config.username}:${config.password}`).toString("base64");
  const url = `${config.baseUrl}/channels?${params.toString()}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ARI originate failed (${response.status}): ${text}`);
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const channelId = payload?.id ?? null;
  return { channelId, payload };
}

export async function originateCall(opts: OriginateOptions): Promise<OriginateResult> {
  if (bridgeConfigured) {
    return originateViaBridge(opts);
  }
  return originateViaAri(opts);
}
