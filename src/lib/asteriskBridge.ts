type RouteLike = {
  id: string;
  name: string;
  domain: string;
  authUsername: string | null;
  authPassword: string | null;
  outboundUri: string | null;
  trunkPrefix: string | null;
  callerIdFormat: string | null;
  maxChannels: number | null;
  metadata: any;
};

function prepareMetadata(input: any) {
  if (!input) return null;
  if (typeof input !== "object") return null;
  if (Array.isArray(input)) return input;
  return input;
}

function bridgeConfig() {
  const base = process.env.ASTERISK_BRIDGE_URL?.replace(/\/$/, "");
  const token = process.env.ASTERISK_BRIDGE_TOKEN;
  if (!base || !token) return null;
  return { base, token };
}

async function request(method: string, path: string, body?: any) {
  const cfg = bridgeConfig();
  if (!cfg) return;
  const url = `${cfg.base}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-bridge-token": cfg.token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bridge request failed (${response.status}): ${text}`);
  }
}

export async function syncAsteriskTrunk(route: RouteLike) {
  const cfg = bridgeConfig();
  if (!cfg) return;
  const payload = {
    id: route.id,
    name: route.name,
    domain: route.domain,
    authUsername: route.authUsername,
    authPassword: route.authPassword,
    outboundUri: route.outboundUri,
    trunkPrefix: route.trunkPrefix,
    callerIdFormat: route.callerIdFormat,
    maxChannels: route.maxChannels,
    metadata: prepareMetadata(route.metadata),
  };
  await request("PUT", `/api/trunks/${route.id}`, payload);
}

export async function deleteAsteriskTrunk(id: string) {
  const cfg = bridgeConfig();
  if (!cfg) return;
  await request("DELETE", `/api/trunks/${id}`);
}
