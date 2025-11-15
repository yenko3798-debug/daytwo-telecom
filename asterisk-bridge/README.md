# Asterisk Bridge Deployment Guide

This package contains the standalone service that connects your Next.js control panel to an Asterisk PBX over ARI. Follow the steps below on a fresh VPS to provision Asterisk, install the bridge, and expose HTTP endpoints the panel can call. The guide assumes Ubuntu 22.04 or newer with root access.

## Quick start

1. `git clone https://your-repo.git && cd your-repo/asterisk-bridge`
2. `cp .env.example .env` and populate every value (see section 4.3)
3. `npm install` to pull runtime deps plus TypeScript tooling such as `@types/ari-client`
4. `npm run build` to compile the TypeScript sources
5. `npm run start` for a foreground test or continue to section 5 to run under systemd

## 1. System preparation

1. Update packages and install dependencies:
   ```bash
   sudo apt update
   sudo apt install -y build-essential git curl wget ufw \
     asterisk asterisk-dev asterisk-config \
     libttspico-utils nodejs npm
   ```
2. Optional but recommended: enable the firewall while allowing SIP, RTP, and ARI traffic. Adjust the ports to match your carrier:
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 5060/udp
   sudo ufw allow 10000:20000/udp
   sudo ufw allow 8088/tcp
   sudo ufw enable
   ```

## 2. Configure Asterisk for ARI control

All configuration files live in `/etc/asterisk`. Create backup copies before editing.

### 2.1 Enable ARI over HTTP

Edit `http.conf` and ensure the following block is present:
```
[general]
enabled = yes
bindaddr = 0.0.0.0
bindport = 8088
tlsenable = no
```

### 2.2 Configure ARI credentials

Create or edit `ari.conf`:
```
[general]
enabled = yes
pretty = yes
allowed_origins = *

[spotlight]
type = user
read_only = no
password = replace-with-ari-password
```
Replace the password with a strong value and keep it for the `.env` file later.

### 2.3 Prepare PJSIP includes

Ensure `pjsip.conf` loads dynamic snippets. Append the following near the end of the file:
```
#include pjsip.d/*.conf
```

Create the directory and set permissions:
```bash
sudo mkdir -p /etc/asterisk/pjsip.d
sudo chown asterisk:asterisk /etc/asterisk/pjsip.d
```

### 2.4 Dialplan entry for outbound campaigns

Add an outbound Stasis handler in `extensions.conf`:
```
[outbound]
exten => _X.,1,NoOp(Outbound via Campaign)
 same => n,Stasis(spotlight,${ARG1},${ARG2},${ARG3},${ARG4},${ARG5})
 same => n,Hangup()
```

Restart or reload Asterisk so the new configuration is active:
```bash
sudo systemctl restart asterisk
```

## 3. Directory layout for media

Create a dedicated sounds directory that the bridge will manage:
```bash
sudo mkdir -p /var/lib/asterisk/sounds/spotlight/cache
sudo chown -R asterisk:asterisk /var/lib/asterisk/sounds/spotlight
```

Ensure Asterisk has write access because the bridge stores cached audio prompts and synthesized TTS files inside `cache/`.

## 4. Install the bridge service

1. Copy the `asterisk-bridge` folder from your repository to the VPS, e.g.:
   ```bash
   git clone https://your-repo.git
   cd your-repo/asterisk-bridge
   ```
2. Install dependencies and build the service:
   ```bash
   npm install
   npm run build
   ```
3. Create the environment file:
   ```bash
   cp .env.example .env
   ```
   Update the values:
   - `HTTP_PORT`: listening port for the bridge API (default 4000).
   - `BRIDGE_TOKEN`: shared secret used by the Next.js panel when syncing trunks.
   - `PANEL_BASE_URL`: base URL of your panel, e.g. `http://panel.internal:3000`.
   - `PANEL_ARI_TOKEN`: must match `ARI_INTERNAL_TOKEN` in the panel `.env`.
   - `PANEL_WEBHOOK_URL`: usually `${PANEL_BASE_URL}/api/webhooks/ari`.
   - `ARI_BASE_URL`: `http://127.0.0.1:8088`.
   - `ARI_USERNAME` / `ARI_PASSWORD`: credentials from `ari.conf`.
   - `ARI_APPLICATION`: `spotlight`.
   - `ASTERISK_PJSIP_DIR`: `/etc/asterisk/pjsip.d`.
   - `ASTERISK_SOUNDS_DIR`: `/var/lib/asterisk/sounds/spotlight`.
   - `SOUNDS_CACHE_DIR`: `/var/lib/asterisk/sounds/spotlight/cache`.
   - `ASTERISK_TRANSPORT`: transport section name defined in `pjsip.conf` (commonly `transport-udp`).
   - `ASTERISK_CONTEXT`: dialplan context that runs `Stasis`, e.g. `outbound`.
   - `ASTERISK_CODECS`: comma-separated list supported by your carrier, such as `ulaw,alaw`.
   - `DEFAULT_RING_TIMEOUT` and `DEFAULT_DIAL_TIMEOUT`: seconds before the bridge gives up on ringing or agent pickup.

4. Test the bridge manually:
   ```bash
   npm run start
   ```
   You should see Fastify listening on the configured port. Use `Ctrl+C` to stop once verified.

## 5. Run the bridge as a system service

Create a systemd unit at `/etc/systemd/system/asterisk-bridge.service`:
```
[Unit]
Description=Spotlight Asterisk Bridge
After=network.target asterisk.service

[Service]
Type=simple
User=asterisk
Group=asterisk
WorkingDirectory=/path/to/asterisk-bridge
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Replace `/path/to/asterisk-bridge` with the actual directory. Reload systemd and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable asterisk-bridge
sudo systemctl start asterisk-bridge
sudo systemctl status asterisk-bridge
```

## 6. Connect the Next.js panel

Update your panel `.env.local` (or deployment secrets) with the bridge endpoint:
```
ASTERISK_BRIDGE_URL=http://192.210.140.80:4000
ASTERISK_BRIDGE_TOKEN=the-same-token-from-bridge-env
```

Restart the Next.js API server after changing environment variables. When an administrator creates, updates, or deletes a SIP route in the panel, the backend now pushes the details to `http://192.210.140.80:4000/api/trunks/:id`.

The campaign runner continues to originate calls directly against Asterisk using ARI. During each call the bridge fetches the flow definition from the panel, executes the nodes (`play`, `gather`, `dial`, `pause`, `hangup`), and posts status updates back to `/api/webhooks/ari`. TTS prompts rely on `pico2wave`, so confirm the package is installed and the Asterisk sounds directory is writable.

## 7. Verification checklist

1. `curl http://127.0.0.1:8088/ari/ping` should return `{"ping":"pong"}` using the ARI credentials.
2. `curl http://192.210.140.80:4000/healthz` should return `{"ok":true}`.
3. In the panel, add a SIP route. Confirm `/etc/asterisk/pjsip.d/route-<id>.conf` appears and `asterisk -rx "pjsip show endpoint bridge-<id>"` succeeds.
4. Launch a small campaign and confirm the callee hears the configured flow prompts, DTMF is captured, and campaign metrics update.

The Asterisk bridge and the panel now work together without any HTTPS requirement, using plain HTTP between servers. Always secure access at the network layer (VPN, firewall rules, or private VLAN) to prevent unauthorized requests.

## 8. Troubleshooting ARI connectivity and bridge startup

### ARI port refuses connections (`ECONNREFUSED ...:8088`)

1. Make sure Asterisk is running: `sudo systemctl status asterisk`. Start or restart it when needed with `sudo systemctl restart asterisk`.
2. Confirm ARI HTTP binding in `/etc/asterisk/http.conf` contains `enabled = yes`, `bindaddr = 0.0.0.0`, and `bindport = 8088`. Reload Asterisk after editing with `sudo asterisk -rx "core reload"`.
3. Check the live status from the Asterisk CLI: `sudo asterisk -rx "http show status"`. It should report `Enabled` and `Server Enabled and Bound to 0.0.0.0:8088`.
4. Verify credentials defined in `/etc/asterisk/ari.conf` (user and password) match the `.env` values. Keep the application mapping in `stasis.conf` rather than `ari.conf`.
5. Test locally on the PBX first:  
   `curl -u spotlight:your-password http://127.0.0.1:8088/ari/ping`  
   If this fails, re-check steps 2–4. If it works locally, test from the remote host running the bridge:  
   `curl -u spotlight:your-password http://107.174.63.45:8088/ari/ping`.
6. If remote access fails but localhost succeeds, open the firewall: `sudo ufw allow 8088/tcp` (or update security groups/NAT rules). Some providers block uncommon ports until explicitly allowed.
7. When the port is still closed, run `sudo ss -ltnp | grep 8088` on the PBX to confirm Asterisk is listening and no other service occupies the port. Pair this with packet captures (`sudo tcpdump -nn -i eth0 port 8088`) if you need to prove the traffic never arrives.
8. `radcli: rc_read_config` warnings during `systemctl status asterisk` are harmless and unrelated to ARI; they can be ignored unless you need Radius accounting.

### ARI endpoint returns 404 on `/ari/ping`

1. Make sure the ARI modules are loaded: `sudo asterisk -rx "module show like ari"`. You should see `res_ari.so`, `res_ari_applications.so`, and `res_ari_events.so`.
2. If they are listed as `Not Running`, load them manually:
   - `sudo asterisk -rx "module load res_ari.so"`
   - `sudo asterisk -rx "module load res_ari_applications.so"`
   - `sudo asterisk -rx "module load res_ari_events.so"`
   Add `load => res_ari.so` (etc.) to `/etc/asterisk/modules.conf` or ensure `autoload=yes` so they persist across restarts.
3. On some Debian/Ubuntu builds, `modules.conf` ships with explicit `noload = res_ari.so` lines. Remove any `noload` entries for `res_ari*`, keep `autoload=yes`, then run `sudo asterisk -rx "core restart now"` so Asterisk reloads with the modules active.
4. Define your ARI applications in `/etc/asterisk/stasis.conf` instead of `ari.conf`. Example:
   ```
   [applications]
   spotlight=spotlight-handler
   ```
   Replace `spotlight-handler` with your actual handler module or dialplan entry, then reload with `sudo asterisk -rx "core reload"`.
5. Retest locally: `curl -u spotlight:password http://127.0.0.1:8088/ari/ping`. Once it returns `{"ping":"pong"}`, retry from the bridge host.

### Bridge fails with `ERR_MODULE_NOT_FOUND: .../dist/server`

1. Always compile the TypeScript sources before running `npm run start`:  
   `npm install` (first time) → `npm run build` → `npm run start`.
2. `npm run dev` uses `tsx` to execute `src/index.ts` directly, so it works without the `dist` folder. The production `start` script expects `dist/server.js`; if the file is missing, delete `dist/`, re-run `npm run build`, and start again.
3. When deploying with systemd, keep `WorkingDirectory` pointing to the folder that contains the freshly built `dist/` directory. Restart the service after every deploy to load the new build.
