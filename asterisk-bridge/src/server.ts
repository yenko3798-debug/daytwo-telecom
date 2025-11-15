import Fastify from "fastify";
import { config } from "./config.js";
import { startFlowRunner } from "./flowRunner.js";
import { originateCall } from "./dialer.js";
import { TrunkPayload, trunkManager } from "./trunkManager.js";

type UpsertBody = Omit<TrunkPayload, "id"> & { id?: string };
type CallBody = {
  route: {
    id: string;
    domain: string;
    outboundUri?: string | null;
    metadata?: Record<string, any> | null;
  };
  dialString: string;
  callerId: string;
  timeoutSeconds?: number;
  variables?: Record<string, string>;
  appArgs?: string[];
};

function validateToken(request: any) {
  const header = request.headers["x-bridge-token"] ?? request.headers["X-Bridge-Token"];
  if (typeof header === "string") return header;
  if (Array.isArray(header) && header.length > 0) return header[0];
  return undefined;
}

export async function startServer() {
  const logger = config.logLevel === "silent" ? false : { level: config.logLevel };
  const app = Fastify({ logger });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/healthz") return;
    const token = validateToken(request);
    if (token !== config.bridgeToken) {
      reply.code(401).send({ error: "Unauthorized" });
      return reply;
    }
  });

  app.get("/healthz", async () => {
    return { ok: true };
  });

  app.put<{ Params: { id: string }; Body: UpsertBody }>("/api/trunks/:id", async (request, reply) => {
    const payload = request.body;
    if (!payload.domain || payload.domain.trim().length === 0) {
      reply.code(400).send({ error: "domain is required" });
      return;
    }
    const trunk: TrunkPayload = {
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

  app.delete<{ Params: { id: string } }>("/api/trunks/:id", async (request, reply) => {
    await trunkManager.remove(request.params.id);
    reply.send({ ok: true });
  });

    app.post<{ Body: CallBody }>("/api/calls", async (request, reply) => {
      const payload = request.body;
      if (!payload?.route || !payload.dialString || !payload.callerId) {
        reply.code(400).send({ error: "Missing call parameters" });
        return;
      }
      try {
        const result = await originateCall(payload);
        reply.send(result);
      } catch (error: any) {
        request.log.error(
          { err: error, routeId: payload.route?.id, dialString: payload.dialString },
          "Call originate failed"
        );
        reply.code(502).send({ error: error?.message ?? "Unable to place call" });
      }
    });

  await startFlowRunner();
  await app.listen({ port: config.httpPort, host: "0.0.0.0" });
}
