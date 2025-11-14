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
    "domain" | "outboundUri" | "trunkPrefix" | "callerIdFormat" | "metadata"
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
  if (route.outboundUri) {
    return route.outboundUri.replace("{number}", dialString);
  }
  if (route.domain.includes("/")) {
    return `${route.domain}${dialString}`;
  }
  return `SIP/${dialString}@${route.domain}`;
}

export async function originateCall(opts: OriginateOptions): Promise<OriginateResult> {
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
