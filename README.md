# AURA Telecom

AURA Telecom is an enterprise outbound dialer platform built using [Tailwind CSS](https://tailwindcss.com) and [Next.js](https://nextjs.org).

## Getting started

To get started with this template, first install the npm dependencies:

```bash
npm install
```

Next, create a `.env.local` file in the root of your project and set the `NEXT_PUBLIC_SITE_URL` variable to your site's public URL:

```
NEXT_PUBLIC_SITE_URL=https://example.com
```

Configure the remaining environment variables required for authentication, the database, and NowPayments:

```
DATABASE_URL=postgres://user:pass@host:5432/db
JWT_SECRET=replace-with-secure-random-string
APP_URL=https://example.com
NOWPAYMENTS_API_KEY=your-nowpayments-api-key
NOWPAYMENTS_IPN_SECRET=your-nowpayments-ipn-secret
NOWPAYMENTS_BASE_URL=https://api.nowpayments.io/v1
```

Leave `NOWPAYMENTS_BASE_URL` unset to use the default production endpoint.

Run the Prisma migrations after updating the schema:

```bash
npx prisma migrate deploy
npx prisma generate
```

Next, run the development server:

```bash
npm run dev
```

Finally, open [http://localhost:3000](http://localhost:3000) in your browser to view the website.

## Customizing

You can start editing this template by modifying the files in the `/src` folder. The site will auto-update as you edit these files.

## Asterisk ARI integration guide

Use the checklist below to connect the outbound dialer to an Asterisk instance via ARI. The application assumes a modern Asterisk build (18+) with ARI, PJSIP and Stasis enabled.

1. **Enable ARI in Asterisk**  
   - In `ari.conf`, set `enabled = yes`, `pretty = yes`, `allowed_origins = *` (or lock to your domains).  
   - Add a user block (e.g. `[lux]`) with `type = user`, `read_only = no`, `password = <strong-password>`.

2. **Expose ARI over HTTPS**  
   - Proxy `/ari` through nginx or caddy with TLS.  
   - Note the base URL such as `https://pbx.example.com/ari`.

3. **Create a Stasis application**  
   - In `ari.conf`, ensure `app = aura` matches your `ARI_APPLICATION`.  
   - In `extensions.conf` (or your PJSIP dialplan), route outbound calls into Stasis:  
     ```
     [outbound]
     exten => _X.,1,NoOp(Outbound via AURA)
       same => n,Stasis(aura,${ARG1},${ARG2},${ARG3})
     ```
     The arguments will receive `campaign_id`, `lead_id`, `session_id`, `flow_id`, `flow_version` respectively.

4. **Configure SIP trunks**  
   - Create PJSIP endpoints named to match the `outboundUri` or `domain` fields you enter in the admin UI.  
   - If authentication is required, store credentials in the route metadata and configure PJSIP registration on the PBX.

5. **Set backend environment variables**  
   Add the following to `.env.local` (or your deployment secrets):
   ```
   ARI_BASE_URL=https://pbx.example.com/ari
   ARI_USERNAME=aura
   ARI_PASSWORD=replace-with-ari-password
   ARI_APPLICATION=aura
   ARI_CONTEXT=outbound
   ARI_EXTENSION=s
   ARI_INTERNAL_TOKEN=replace-with-long-random-string
   ASTERISK_BRIDGE_URL=http://192.210.140.80:4000
   ASTERISK_BRIDGE_TOKEN=replace-with-bridge-token
   ```
   `ARI_INTERNAL_TOKEN` secures the internal endpoints the PBX calls when it needs call-flow definitions.
   `ASTERISK_BRIDGE_URL` and `ASTERISK_BRIDGE_TOKEN` point to the bridge service described in `asterisk-bridge/README.md`.

6. **Webhook endpoints**  
   - `POST /api/webhooks/ari` receives status updates (`call.answered`, `call.completed`, etc.) from your middleware or dialplan. Pass `sessionId`, optional `dtmf`, `durationSeconds`, `recordingUrl`, `costCents`.  
   - `GET /api/ari/sessions/:sessionId` (requires header `x-ari-token`) returns the call session, campaign metadata, and the flow definition snapshot for the PBX to execute.

7. **Runtime expectations**  
   - Every campaign reserves $0.10 per lead (change via `RATE_PER_1000_LEADS_CENTS` in `lib/flows.ts`) when the session is created. Ensure user balances in the admin panel are topped up before launching.  
   - Call sessions are throttled according to `callsPerMinute` and `maxConcurrentCalls`. Adjust these in the start page or admin dashboard to match your trunk capacity.

8. **PBX application logic**  
   - Inside your ARI/Stasis handler, fetch the session payload from `GET /api/ari/sessions/:id`, execute the steps described in the `flow.definition`, and report final status back to `POST /api/webhooks/ari`.  
   - The flow definition contains ordered nodes (`play`, `gather`, `dial`, `pause`, `hangup`). Respect `next` and `defaultNext` branches to reproduce the IVR exactly as designed in the UI.

9. **Testing checklist**  
   - Create a SIP route in the admin panel and ensure dialing the trunk from the PBX succeeds.  
   - Build a flow in the call-flow atelier, export JSON if needed for manual review.  
   - Launch a small campaign from `/start`, upload a few leads, and verify calls reach the callee with the configured caller ID and prompts.  
   - Monitor the admin dashboard for real-time session updates and balance debits.

Following the steps above ensures the web application, payment ledger, and PBX remain in sync and every call uses the exact flow created in the UI.

## License

This site template is a commercial product and is licensed under the [Tailwind Plus license](https://tailwindcss.com/plus/license).

## Learn more

To learn more about the technologies used in this site template, see the following resources:

- [Tailwind CSS](https://tailwindcss.com/docs) - the official Tailwind CSS documentation
- [Next.js](https://nextjs.org/docs) - the official Next.js documentation
- [Headless UI](https://headlessui.dev) - the official Headless UI documentation
- [MDX](https://mdxjs.com) - the MDX documentation
