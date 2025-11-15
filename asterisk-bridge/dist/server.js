import Fastify from "fastify";
import { config } from "./config";
import { startFlowRunner } from "./flowRunner";
import { trunkManager } from "./trunkManager";
function validateToken(request) {
    const header = request.headers["x-bridge-token"] ?? request.headers["X-Bridge-Token"];
    if (typeof header === "string")
        return header;
    if (Array.isArray(header) && header.length > 0)
        return header[0];
    return undefined;
}
export async function startServer() {
    const logger = config.logLevel === "silent" ? false : { level: config.logLevel };
    const app = Fastify({ logger });
    app.addHook("onRequest", async (request, reply) => {
        if (request.url === "/healthz")
            return;
        const token = validateToken(request);
        if (token !== config.bridgeToken) {
            reply.code(401).send({ error: "Unauthorized" });
            return reply;
        }
    });
    app.get("/healthz", async () => {
        return { ok: true };
    });
    app.put("/api/trunks/:id", async (request, reply) => {
        const payload = request.body;
        if (!payload.domain || payload.domain.trim().length === 0) {
            reply.code(400).send({ error: "domain is required" });
            return;
        }
        const trunk = {
            id: request.params.id,
            name: payload.name ?? request.params.id,
            domain: payload.domain,
            authUsername: payload.authUsername ?? null,
            authPassword: payload.authPassword ?? null,
            outboundUri: payload.outboundUri ?? null,
            trunkPrefix: payload.trunkPrefix ?? null,
            callerIdFormat: payload.callerIdFormat ?? null,
            maxChannels: payload.maxChannels ?? null,
            metadata: payload.metadata ?? null,
        };
        await trunkManager.upsert(trunk);
        reply.send({ ok: true });
    });
    app.delete("/api/trunks/:id", async (request, reply) => {
        await trunkManager.remove(request.params.id);
        reply.send({ ok: true });
    });
    await startFlowRunner();
    await app.listen({ port: config.httpPort, host: "0.0.0.0" });
}
