import { config } from "./config.js";
import { toSafeId } from "./trunkManager.js";

type RouteLike = {
  id: string;
  domain: string;
  outboundUri?: string | null;
  metadata?: Record<string, any> | null;
};

type OriginateRequest = {
  route: RouteLike;
  dialString: string;
  callerId: string;
  timeoutSeconds?: number;
  variables?: Record<string, string>;
  appArgs?: string[];
};

export type OriginateResponse = {
  channelId: string | null;
  payload: any;
};

function metadataTemplate(route: RouteLike) {
  if (!route.metadata || typeof route.metadata !== "object" || Array.isArray(route.metadata)) {
    return undefined;
  }
  const template = (route.metadata as Record<string, any>).dialEndpoint;
  if (typeof template === "string" && template.length > 0) {
    return template;
  }
  return undefined;
}

function buildEndpoint(route: RouteLike, dialString: string) {
  const template = metadataTemplate(route) ?? route.outboundUri ?? null;
  if (template) {
    return template.includes("{number}") ? template.replace("{number}", dialString) : template;
  }
  if (route.domain.includes("/")) {
    return `${route.domain}${dialString}`;
  }
  const safeId = toSafeId(route.id);
  return `PJSIP/bridge-${safeId}/${dialString}`;
}

export async function originateCall(body: OriginateRequest): Promise<OriginateResponse> {
  const endpoint = buildEndpoint(body.route, body.dialString);
  const params = new URLSearchParams();
  params.set("endpoint", endpoint);
  params.set("callerId", body.callerId);
  params.set("timeout", String(Math.max(5, body.timeoutSeconds ?? config.dialTimeout)));
  params.set("app", config.ariApplication);
  if (body.variables) {
    for (const [key, value] of Object.entries(body.variables)) {
      params.append("variables", `${key}=${value}`);
    }
  }
  if (body.appArgs?.length) {
    params.set("appArgs", body.appArgs.join(","));
  }

  const auth = Buffer.from(`${config.ariUsername}:${config.ariPassword}`).toString("base64");
  const url = `${config.ariBaseUrl}/channels?${params.toString()}`;
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
