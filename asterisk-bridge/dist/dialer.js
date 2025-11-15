import { config } from "./config.js";
import { toSafeId } from "./trunkManager.js";
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
    const looksLikeChannel = /^[A-Za-z0-9]+\/.+/.test(normalized);
    const looksLikeUri = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized) || normalized.includes("@");
    if (looksLikeChannel || looksLikeUri) {
        if (looksLikeChannel)
            return normalized;
        const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized);
        const uri = hasScheme ? normalized : `sip:${normalized}`;
        return `PJSIP/${uri}`;
    }
    return null;
}
function buildEndpoint(route, dialString) {
    const template = renderTemplate(metadataTemplate(route) ?? route.outboundUri ?? null, dialString);
    if (template) {
        return template;
    }
    if (route.domain.includes("/")) {
        return `${route.domain}${dialString}`;
    }
    const safeId = toSafeId(route.id);
    return `PJSIP/bridge-${safeId}/${dialString}`;
}
export async function originateCall(body) {
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
    let payload = null;
    try {
        payload = await response.json();
    }
    catch {
        payload = null;
    }
    const channelId = payload?.id ?? null;
    return { channelId, payload };
}
