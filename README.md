SwiftChat
SwiftChat is a lightweight, anonymous, random text-chat web app. It matches two people for a temporary conversation without requiring an account or sign-in. The frontend is built with React and Vite; the realtime backend runs on Cloudflare Workers and Durable Objects.
Project status: deployed prototype / active development. A successful Cloudflare deployment confirms that the Worker and static assets were uploaded; it does not prove that all chat flows, security controls, or load behaviour have been tested. Review the security notes and outstanding work before inviting the public.

Contents
- Goals and current scope
- Technology
- Architecture
- Repository layout
- How a chat session works
- Protocol overview
- Run locally
- Configuration and secrets
- Build and deploy
- Security model
- Privacy model and limitations
- Testing and verification
- Troubleshooting
- Development roadmap
- Contributing
Goals and current scope
SwiftChat is intended to make it easy to start a spontaneous, temporary conversation with another person.
Current intended capabilities
- Join without creating an account.
- Enter a preferred display name.
- Select interests for matching.
- Choose random matching or interest-based matching.
- Match two participants through a waiting queue.
- Exchange text messages over a WebSocket connection.
- Display connection, queue, and chat status in the interface.
- End a conversation and handle a peer disconnect.
- Use short-lived, signed room tickets when connecting to a chat room.
- Serve the frontend and WebSocket/API routes from a Cloudflare deployment.
Actual behaviour depends on the currently deployed source code. Features such as reporting, blocking, human moderation, account recovery, end-to-end encryption, and comprehensive global abuse prevention should not be assumed to exist unless implemented and verified separately.
Technology
Area	Technology
Frontend	React, Vite, JavaScript ES modules
Realtime transport	WebSocket
Backend	Cloudflare Workers
Stateful coordination	Cloudflare Durable Objects
Deployment and local Worker development	Wrangler v4
Package management	npm workspaces
Chat room authentication	HMAC-signed room tickets using Web Crypto


The repository is a small npm monorepo. The root package.json declares apps/web and apps/worker as workspaces.
Architecture
Browser
  |
  | HTTPS page / WSS realtime connections
  v
Cloudflare Worker (apps/worker/src/index.js)
  |-- Static assets: React/Vite build in apps/web/dist
  |-- GET /api/health
  |-- WebSocket /ws/match
  |       `-- Matchmaker Durable Object
  |             - validates a join request
  |             - queues participants and selects a compatible peer
  |             - issues short-lived signed room tickets
  |
  `-- WebSocket /ws/room/<room-id>
          `-- ChatRoom Durable Object
                - verifies the signed ticket and room/slot claims
                - accepts up to two participants
                - relays chat and typing events
                - handles leave/disconnect cleanup
Frontend responsibilities
The frontend collects the preferred name, interests, and matching mode; opens the matchmaking socket; reacts to queue/match events; connects to the selected room using the ticket; renders messages and connection state; and provides the controls to send messages or end a chat.

The frontend is not a security boundary. Any value received from a browser must be validated again by the Worker. A user can modify requests or build a custom WebSocket client without using the SwiftChat interface.
Worker responsibilities
The Worker entry point checks the request path, WebSocket upgrade, and request origin, then forwards matchmaking requests to the Matchmaker Durable Object and room requests to the appropriate ChatRoom Durable Object. Other eligible requests are served through the static asset binding.
Why Durable Objects?
A Durable Object provides a coordination point for stateful realtime activity. SwiftChat uses one named Matchmaker instance for queue coordination and room-specific Durable Object instances for two-person conversations. The precise consistency, isolation, and scaling characteristics depend on the deployed code and Cloudflare platform configuration.
Repository layout
swiftchat/
├── package.json                      # npm workspaces and root scripts
├── package-lock.json
├── .gitignore
├── .env.example
├── README.md
├── apps/
│   ├── web/
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── public/
│   │   │   ├── favicon.svg
│   │   │   └── _headers               # Optional static-response headers
│   │   ├── src/
│   │   │   ├── main.jsx
│   │   │   ├── App.jsx
│   │   │   ├── components/            # Join form, chat UI and status components
│   │   │   ├── features/
│   │   │   │   ├── matchmaking/       # Matchmaking hook and input validation
│   │   │   │   └── chat/              # WebSocket hook, reducer, validation
│   │   │   ├── hooks/                 # Reusable React hooks
│   │   │   ├── lib/                   # Socket URLs, protocol and text helpers
│   │   │   ├── styles/                # Global, form and chat styles
│   │   │   └── tests/                 # Frontend test files (runner setup required)
│   │   ├── vite.config.js
│   │   └── dist/                      # Generated by `npm run build`; don't edit manually
│   └── worker/
│       ├── package.json
│       ├── wrangler.jsonc             # Worker, assets, Durable Object bindings
│       └── src/
│           ├── index.js               # Worker request router
│           ├── durable-objects/
│           │   ├── Matchmaker.js
│           │   └── ChatRoom.js
│           ├── lib/
│           │   ├── cleanup.js
│           │   ├── matching.js
│           │   ├── origin-check.js
│           │   ├── protocol.js
│           │   ├── rate-limit.js
│           │   ├── ticket-auth.js
│           │   └── validation.js
│           └── tests/                 # Worker test files (runner setup required)
├── tests/
│   ├── integration/
│   ├── e2e/
│   └── load/
└── docs/
    ├── architecture.md
    ├── privacy-model.md
    └── deployment.md
Some test files and helper modules have existed as empty placeholders during development. Check the current contents before relying on any listed test or control; a file existing in the tree does not mean its tests are runnable or its protection is active.
How a chat session works
1. Join: the browser sends a versioned join event containing the preferred name, interests, and matching mode to /ws/match.
2. Queue: if no compatible peer is available, the interface shows that the user is waiting.
3. Match: when a compatible peer is found, the Matchmaker creates a room and issues a signed, short-lived ticket for each participant.
4. Connect: the browser opens /ws/room/<room-id> and presents the ticket as a WebSocket subprotocol value. The ChatRoom validates the signature, expiry, room, and participant slot before admitting the connection.
5. Chat: the room relays allowed message and typing events between the two connected participants. The browser updates its local message list.
6. End: either participant can leave. A disconnect or explicit leave should notify the other participant and close the room sockets.
A reconnect or network failure can interrupt a conversation. The interface should not imply that a message was delivered until the server acknowledges it.
Protocol overview
The application uses JSON events with a versioned envelope:
{
  "v": 1,
  "type": "event_name",
  "payload": {}
}
v is the protocol version, type identifies the event, and payload contains the event data. Invalid JSON, wrong envelope versions, invalid event types, or malformed payloads should be rejected rather than trusted.
Matchmaking events
The current client/server flow uses events including:
- Client to server: join with preferredName, interests, and mode.
- Server to client: queued, matched, and error.
The exact matched payload is defined by the running source code. Treat room IDs and tickets as untrusted until verified by the ChatRoom backend.
Chat events
The room flow uses events including:
- Client to server: message, typing, and leave.
- Server to client: waiting_for_peer, ready, message, message_sent, peer_left, ended, and error.
A message is expected to contain a text body and a client-generated ID; the server should validate the input and return an acknowledgement for the message ID. Do not add new event types without validating them in the Worker and updating the client handlers and tests.
Run locally
Prerequisites
- A supported, maintained Node.js LTS release and npm.
- Git, if cloning from a repository.
- A Cloudflare account for deployment; a local account login is not normally necessary just to build the frontend.
1. Install dependencies
From the repository root:
npm install
2. Configure a local Worker secret
The Worker requires ROOM_TICKET_SECRET for signing and verifying room tickets. For local development, Wrangler can load variables from apps/worker/.dev.vars.

Generate a random value locally:
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
Create apps/worker/.dev.vars containing the generated value:
ROOM_TICKET_SECRET="PASTE_THE_LOCALLY_GENERATED_VALUE_HERE"
Replace the example text locally; do not use that literal example as a real secret. Verify that .dev.vars is excluded by .gitignore before committing. Never paste the generated secret into a chat, issue, screenshot, or repository.

The configured local origin allowlist in apps/worker/wrangler.jsonc should include:
http://localhost:5173
http://127.0.0.1:5173
3. Start the Worker
Open PowerShell terminal 1:
cd apps/worker
npx wrangler dev
Wrangler normally starts the local Worker on http://localhost:8787 unless configured otherwise. Keep this terminal open.
4. Start the frontend
Open PowerShell terminal 2 from the repository root:
npm run dev:web
Vite normally serves the frontend at http://localhost:5173. The frontend's WebSocket helper defaults to the local Worker endpoint when running on the local Vite host/port. If you change ports or hosts, check apps/web/src/lib/websocket.js and the Worker origin allowlist together.

Open the frontend in two separate browser sessions to test matching, sending messages in both directions, and ending the chat. Use different preferred names so you can distinguish the two participants.
Root npm scripts
Command	Purpose
npm run dev	Starts the web workspace's Vite development server only.
npm run dev:web	Starts Vite in the web workspace.
npm run dev:worker	Starts Wrangler in the Worker workspace.
npm run build	Builds the React frontend into apps/web/dist.


The Worker workspace does not currently define an npm build script. Use Wrangler to run and bundle/deploy it:
cd apps/worker
npx wrangler deploy --dry-run
A successful dry run is a bundle/configuration check, not a complete integration or security test.
Configuration and secrets
apps/worker/wrangler.jsonc
The current configuration defines:
- Worker name: swiftchat-worker.
- Entrypoint: src/index.js.
- MATCHMAKER and CHAT_ROOM Durable Object bindings.
- Durable Object migrations for Matchmaker and ChatRoom.
- ALLOWED_ORIGINS, which should contain exact browser origins, separated by commas.
- Static assets from ../web/dist, with API and WebSocket routes sent through the Worker first.
- ROOM_TICKET_SECRET as a required Worker secret, if the secrets.required configuration is present in your current file.
The published site currently uses the workers.dev hostname configured in Cloudflare. If the hostname changes, update the production origin allowlist and frontend WebSocket configuration, then rebuild and redeploy.
Production secret
Set the signing secret through Wrangler from apps/worker:
npx wrangler secret put ROOM_TICKET_SECRET
Wrangler prompts for the value. Generate a strong random value locally and paste it only into that prompt. Do not put the actual secret in wrangler.jsonc, .env.example, React code, source control, or browser-visible variables.

To list configured secret names without exposing their values:
npx wrangler secret list
Environment-variable safety
Anything embedded in frontend JavaScript is public. A VITE_* variable should never contain a secret. Keep private keys, API tokens, signing secrets, and credentials in the Worker secret store or another appropriately protected server-side secret manager.
Build and deploy
The current deployment serves the built React assets and Worker routes from one Cloudflare Worker.
1. Build the frontend
Run from the repository root:
npm install
npm run build
Check for build errors before continuing. Vite writes generated files to apps/web/dist; do not edit generated assets by hand.
2. Authenticate Wrangler
cd apps/worker
npx wrangler whoami
If needed, authenticate with:
npx wrangler login
Treat locally stored Wrangler credentials as sensitive. Protect the development machine and never upload credential files to GitHub.
3. Check the deployment bundle
npx wrangler deploy --dry-run
Confirm that the output includes the MATCHMAKER, CHAT_ROOM, and ASSETS bindings and that no configuration errors are reported.
4. Set/verify production settings
Before public use:
- Confirm ROOM_TICKET_SECRET exists in the production Worker secret list.
- Confirm ALLOWED_ORIGINS includes the exact deployed website origin, not just localhost.
- Confirm the Durable Object migrations are consistent with the existing Cloudflare deployment.
- Review the wrangler.jsonc configuration and any build/deployment automation for unintended permissions or secret exposure.
5. Deploy
Run from apps/worker:
npx wrangler deploy
6. Smoke-test the release
Open the deployed homepage and the health route:
https://swiftchat-worker.swiftchat.workers.dev/
https://swiftchat-worker.swiftchat.workers.dev/api/health
Then use two separate browser sessions to verify the full flow: queue, match, room connection, bidirectional messaging, acknowledgement, explicit leave, tab close/disconnect, and a fresh subsequent match. The health route returning successfully does not verify WebSocket authentication or chat correctness.
Security model
SwiftChat is designed as a no-account chat prototype. Its security depends on server-side validation and the correct configuration of Cloudflare and the developer accounts that can deploy the code.
Controls present in or intended by the current code
- Origin allowlist: the Worker checks request origins against ALLOWED_ORIGINS. Origin checks help protect browser-based endpoints but are not authentication: non-browser clients can send custom headers, so the room ticket must still be validated.
- Signed room tickets: room tickets use HMAC signing and include authorization claims and an expiry. The ChatRoom should reject invalid signatures, expired tickets, wrong room IDs, and invalid or already occupied slots.
- Input validation: the server should validate the protocol envelope, allowed event names, text type, message size, preferred-name length, interests, and matching mode.
- WebSocket limits: the room handler includes a per-connection event throttle and size/text constraints. These are useful guardrails but do not, by themselves, prevent abuse from many new connections or enforce a global quota.
- Room cleanup: explicit leave and socket close/error handlers should notify the peer, close room sockets, and release temporary state.
- Secret management: the production room-ticket key is configured as a Cloudflare Worker secret rather than frontend configuration.
These are descriptions of the implementation approach, not a security certification. The source should be audited and the controls tested before being relied on.
Important limits and hardening requirements
1. Rate limiting: per-socket message throttling can often be reset by reconnecting. Add and test matchmaking/connection throttling and an abuse strategy that is suitable for the application's threat model.
2. Authentication and ticket lifecycle: test forged, malformed, expired, wrong-room, and slot-reuse tickets. Keep ticket lifetime short and ensure the ticket only authorizes the intended room and slot.
3. Schema validation: validate every event and field on the server. Do not trust a client's sender name, room, slot, timestamp, message ID, or claimed delivery status.
4. Resource exhaustion: bound queue size, concurrent connections, event frequency, payload sizes, and expensive per-request work. Define appropriate handling when Durable Objects or sockets are unavailable.
5. Abuse and safety: provide a plan for spam, harassment, threats, illegal content, and users who repeatedly reconnect to evade limits. Reporting/blocking and moderation are not implied by the current feature set.
6. Security headers: verify that the deployed static-asset response includes the intended headers. A file in public/ is not proof that headers reached the response; test the actual HTTP response.
7. Dependencies and supply chain: keep dependencies updated, review npm audit output, protect the GitHub default branch, enable MFA, and restrict connected GitHub/Cloudflare integrations to the required repository and permissions.
8. Secrets: rotate any credential that was committed, logged, or otherwise exposed. Deleting a secret from the latest commit does not remove it from repository history.
9. Observability: keep useful operational error reporting without logging message bodies, tickets, secrets, or unnecessary personal information.
10. Availability: a public workers.dev URL is reachable, but that alone is not an uptime, DDoS protection, or scaling guarantee. Review Cloudflare account settings, limits, usage, and costs.
GitHub and Cloudflare account protection
A website vulnerability does not automatically compromise the GitHub or Cloudflare account used to deploy it. Account compromise becomes more plausible if an attacker obtains credentials, takes over the repository or deployment workflow, steals a local Wrangler credential, or can abuse an overly powerful token.

Recommended safeguards:
- Enable passkeys or multi-factor authentication on GitHub and Cloudflare.
- Grant Cloudflare's GitHub integration access only to the SwiftChat repository if that is all it needs.
- Protect the production branch and review changes before deployment.
- Use least-privilege API tokens and avoid long-lived tokens when a safer method is available.
- Keep .dev.vars, .env files, Wrangler credentials, and signing secrets out of version control.
- Do not put secrets in the Vite frontend bundle.
- Review GitHub Actions or other automation permissions and the secrets available to deploy jobs.
Privacy model and limitations
SwiftChat does not require a user account in the current design. The app uses a preferred name and interests for its matching flow; those values should be treated as user-supplied and potentially sensitive.

The current chat implementation relays live messages through WebSockets and does not intentionally write message transcripts to Durable Object persistent storage. However, messages can exist temporarily in browser memory, socket buffers, and runtime memory. Cloudflare and other infrastructure may process connection metadata and operational logs according to their own settings and policies. Do not promise “zero logs,” complete untraceability, or guaranteed deletion without independently verifying all relevant infrastructure and retention settings.

The current design is not end-to-end encrypted. HTTPS/WSS encrypts traffic in transit to the service, but the Worker receives message content to relay it. End-to-end encryption would require a separate, carefully designed cryptographic protocol and key management.

Before operating the service publicly, publish a privacy notice explaining the information collected, how messages and connection metadata are processed, the retention model, available safety controls, and a contact method. Avoid soliciting real names, addresses, financial details, authentication codes, or other sensitive information in anonymous conversations.
Testing and verification
The repository contains test-file locations for matching UI/reducer logic, Worker matching/chat/cleanup/security behaviour, integration flows, and an E2E chat session. During development, several of these files were empty placeholders, and the current workspace package files do not define a test runner or test script. Therefore, do not assume npm test works or that a test file's existence means the behaviour has been tested.

Before public launch, configure a test runner and make these checks repeatable:
- Reducer: local/remote messages, duplicate IDs, acknowledgement, clear, and visible-message cap.
- Matching: valid and invalid modes, interest matching, no self-match, peer selection, empty queue, and disconnect during queueing.
- Tickets: valid signatures, invalid signatures, expired tickets, wrong room IDs, invalid slots, and replay/duplicate connection attempts.
- Chat room: malformed JSON, unsupported event types, non-text payloads, oversized payloads, rate limits, leaving, abrupt disconnects, and third-party admission.
- Origin handling: allowed local/production origins, disallowed origins, missing origin, and malformed origin values according to the chosen policy.
- Integration/E2E: two clients can match, exchange messages both ways, see delivery acknowledgements, and terminate cleanly.
- Load/abuse: reconnect storms, queue flooding, sustained message traffic, and concurrent Durable Object activity within the intended limits.
Useful manual checks during development:
# From the repository root: frontend production build
npm run build

# From apps/worker: inspect Wrangler authentication
npx wrangler whoami

# From apps/worker: bundle/configuration validation without publishing
npx wrangler deploy --dry-run

# From apps/worker: inspect deployed secret names, not values
npx wrangler secret list
Troubleshooting
Missing script: "build" in apps/worker
Expected with the current package file. The build script belongs to the web workspace. Run npm run build from the repository root, then use Wrangler from apps/worker.
encodeEvent or parseEvent is not exported
Ensure apps/web/src/lib/protocol.js exports named functions encodeEvent and parseEvent, since the matchmaking and chat hooks import them. Rebuild after correcting the export names.
WebSocket requests fail in local development
- Confirm Wrangler is running and note its actual port.
- Confirm Vite is using the host/port included in ALLOWED_ORIGINS.
- Inspect apps/web/src/lib/websocket.js and check whether VITE_CHAT_API_URL overrides the default base URL.
- Check the browser console and Worker terminal for handshake, origin, and ticket errors.
Production page loads, but matching or chat fails
A page can load even when the Worker secret, origin allowlist, or WebSocket routing is incorrect. Confirm the secret exists, confirm the deployed origin is allowed, check /api/health, and inspect Worker logs for errors without printing secrets or tickets. Test the matching WebSocket and room connection separately.
Asset changes do not appear
Run npm run build at the repository root before npx wrangler deploy. Do not hand-edit apps/web/dist; it is generated output.
A Durable Object migration fails
Do not casually rename migration tags, remove classes, or rewrite already-applied migrations. Inspect the existing deployed configuration and use a new migration when a schema/class change requires it.
Development roadmap
Prioritize work in this order:
1. Audit origin validation, ticket authentication, input validation, matchmaking, and room lifecycle code.
2. Implement and test matchmaking abuse controls and a carefully scoped rate-limiting policy.
3. Add a runnable test setup and make unit/integration/E2E/security tests pass.
4. Verify security headers and production origin configuration against actual deployed responses.
5. Add abuse reporting, blocking, moderation, privacy disclosure, and operational handling appropriate to the intended user community.
6. Test reconnection, concurrency, resource limits, and failure recovery.
7. Review GitHub/Cloudflare permissions, dependency vulnerabilities, deployment controls, and secret rotation procedures.
Contributing
1. Create a branch for the change.
2. Keep commits focused and avoid including generated files, local credentials, or secrets.
3. Validate untrusted data on the server, even if the frontend already validates it.
4. Update the protocol documentation and tests when changing event shapes or names.
5. Run the frontend build and the available Worker checks before opening a pull request.
6. Describe known limitations honestly; don't claim a security control or test is complete until it has been verified.