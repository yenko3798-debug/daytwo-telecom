import { promises as fs } from "fs";
import { join } from "path";
import { config } from "./config";
import { hashKey, runCommand } from "./utils";

export type TrunkPayload = {
  id: string;
  name: string;
  domain: string;
  authUsername?: string | null;
  authPassword?: string | null;
  outboundUri?: string | null;
  trunkPrefix?: string | null;
  callerIdFormat?: string | null;
  maxChannels?: number | null;
  metadata?: Record<string, any> | null;
};

function toSafeId(id: string) {
  const trimmed = id.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (trimmed.length > 0) return trimmed;
  return hashKey(id).slice(0, 12);
}

function buildConfig(payload: TrunkPayload) {
  const safe = toSafeId(payload.id);
  const endpoint = `bridge-${safe}`;
  const aor = `${endpoint}-aor`;
  const auth = `${endpoint}-auth`;
  const hasAuth = Boolean(payload.authUsername && payload.authPassword);
  const lines: string[] = [];
  lines.push(`[${endpoint}]`);
  lines.push(`type=endpoint`);
  lines.push(`transport=${config.transport}`);
  lines.push(`context=${config.context}`);
  lines.push(`disallow=all`);
  config.codecs.forEach((codec) => {
    lines.push(`allow=${codec}`);
  });
  if (payload.callerIdFormat) {
    lines.push(`callerid=${payload.callerIdFormat}`);
  }
  if (payload.outboundUri) {
    lines.push(`outbound_proxy=${payload.outboundUri}`);
  }
  if (payload.trunkPrefix) {
    lines.push(`set_var=TRUNK_PREFIX=${payload.trunkPrefix}`);
  }
  if (payload.metadata && typeof payload.metadata === "object") {
    Object.entries(payload.metadata).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      const normalized = String(value);
      lines.push(`set_var=${key.toUpperCase()}=${normalized}`);
    });
  }
  lines.push(`aors=${aor}`);
  if (hasAuth) {
    lines.push(`outbound_auth=${auth}`);
  }
  lines.push("");
  lines.push(`[${aor}]`);
  lines.push(`type=aor`);
  const contactHost = payload.domain.startsWith("sip:") ? payload.domain : `sip:${payload.domain}`;
  lines.push(`contact=${contactHost}`);
  lines.push(`qualify_frequency=60`);
  lines.push(`max_contacts=${Math.max(payload.maxChannels ?? 1, 1)}`);
  lines.push("");
  if (hasAuth) {
    lines.push(`[${auth}]`);
    lines.push(`type=auth`);
    lines.push(`auth_type=userpass`);
    lines.push(`username=${payload.authUsername}`);
    lines.push(`password=${payload.authPassword}`);
    lines.push("");
  }
  const registrationName = `${endpoint}-registration`;
  if (hasAuth) {
    lines.push(`[${registrationName}]`);
    lines.push(`type=registration`);
    lines.push(`outbound_auth=${auth}`);
    lines.push(`server_uri=${contactHost}`);
    lines.push(`client_uri=sip:${payload.authUsername}@${payload.domain}`);
    lines.push(`retry_interval=30`);
    lines.push("");
  }
  return lines.join("\n");
}

class TrunkManager {
  async upsert(payload: TrunkPayload) {
    const file = join(config.pjsipDir, `route-${payload.id}.conf`);
    const content = buildConfig(payload);
    await fs.writeFile(file, content);
    await runCommand("asterisk", ["-rx", "pjsip reload"]);
    return { file };
  }

  async remove(id: string) {
    const file = join(config.pjsipDir, `route-${id}.conf`);
    try {
      await fs.unlink(file);
    } catch (error: any) {
      if (error?.code !== "ENOENT") throw error;
    }
    await runCommand("asterisk", ["-rx", "pjsip reload"]);
    return { file };
  }
}

export const trunkManager = new TrunkManager();
