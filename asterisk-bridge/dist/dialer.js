import { config } from "./config.js";
import { toSafeId } from "./trunkManager.js";
import { logger } from "./logger.js";
function metadataTemplate(route) {
    if (!route.metadata || typeof route.metadata !== "object" || Array.isArray(route.metadata)) {
        return undefined;
    }
    const template = route.metadata.dialEndpoint;
    if (typeof template === "string" && template.length > 0) {
        return template;
    }
    return undefined;
}
function renderTemplate(template, dialString) {
    if (!template)
        return null;
    const replaced = template.includes("{number}") ? template.replaceAll("{number}", dialString) : template;
    const normalized = replaced.trim();
    if (!normalized)
        return null;
    if (/^[A-Za-z0-9]+\/.+/.test(normalized)) {
        return { type: "channel", value: normalized };
    }
    const sipMatch = normalized.match(/^(sips?):([^@]+)@(.+)$/i);
    if (sipMatch) {
        return { type: "sipUri", scheme: sipMatch[1].toLowerCase(), user: sipMatch[2], host: sipMatch[3] };
    }
    const genericMatch = normalized.includes("@") ? normalized.match(/^([^@]+)@(.+)$/) : null;
    if (genericMatch) {
        return { type: "sipUri", scheme: "sip", user: genericMatch[1], host: genericMatch[2] };
    }
    return null;
}
function buildEndpoint(route, dialString) {
    const template = renderTemplate(metadataTemplate(route) ?? route.outboundUri ?? null, dialString);
    if (template?.type === "channel") {
        return template.value;
    }
    if (template?.type === "sipUri") {
        const safeId = toSafeId(route.id);
        const fallbackHost = route.domain.replace(/^sips?:\/\//i, "").replace(/^sips?:/i, "");
        const host = template.host || fallbackHost;
        const target = host ? `${template.scheme}:${template.user}@${host}` : `${template.scheme}:${template.user}`;
        return `PJSIP/bridge-${safeId}/${target}`;
    }
    if (route.domain.includes("/")) {
        return `${route.domain}${dialString}`;
    }
    const safeId = toSafeId(route.id);
    return `PJSIP/bridge-${safeId}/${dialString}`;
}
export async function originateCall(body) {
    const endpoint = buildEndpoint(body.route, body.dialString);
    logger.debug("Originating ARI call", {
        routeId: body.route.id,
        dialString: body.dialString,
        endpoint,
        callerId: body.callerId,
    });
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
        logger.warn("ARI originate failed", { status: response.status, text });
        throw new Error(`ARI originate failed (${response.status}): ${text}`);
    }
    let payload = null;
    try {
        payload = await response.json();
    }
    catch {
        payload = null;
    }
    const channelId = payload?.id ?? null;
    logger.info("ARI originate succeeded", { channelId, routeId: body.route.id, dialString: body.dialString });
    return { channelId, payload };
}
