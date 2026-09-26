# Little Hours: durable homes, private company, and optional desktop presence

Research checked **September 25, 2026, America/Los_Angeles**. Baseline: `origin/main`, `05e742603075595e180c4639ac4c1b7236d843de`. This is a selective architecture and product assessment, not an implementation, penetration test, load test, or vendor purchase. Primary documentation was checked directly; recommendations and effort estimates are judgments. No accounts, deployment, downloads, or paid services were created. Earlier [web/social](../web-and-social.md) and [desktop/notch](../desktop-and-notch.md) reports provide competitor context; this report examines what the actual application needs to support that direction.

## Decision

**Protect the home before connecting it.** Ship recoverable saves and a transactional progression record, then offline launch, then optional accounts and private friend visits. Use **IndexedDB through idb** for the first persistence upgrade; select **Supabase** for the first social proof of concept if that stage is authorized. Keep room ownership and editing simple. Reserve **SwiftUI/AppKit** for a later Mac companion, with the website remaining complete. Do not buy a multiplayer engine, introduce collaborative editing, or rewrite the frontend to achieve occasional visits and study presence.

The room has a useful loop already: choose a home, personalize it, focus, earn an extension, return. The immediate platform risk is losing that attachment through save failure, confusing progress migration, or misleading social status. Another timer widget does not resolve those risks.

## What exists and what is missing

Source anchors below are baseline repository paths and one-based lines, suitable for reviewing against the recorded commit.

| Existing capability | Evidence | Consequence / missing capability |
|---|---|---|
| Plain ES modules, Vite 8.3.0, Babylon 9.27.1 | `package.json:1` | None of the recommendations requires React. Adding a React-specific collaboration UI would create unnecessary framework work. |
| One localStorage JSON document | `src/main.js:41`, `src/state.js:73` | Easy to inspect and migrate, but every update clones and rewrites a broad snapshot. There is no database transaction spanning two tabs' read-modify-write cycles. |
| Defensive restoration and normalization | `src/state.js:19`, `src/house.js:22` | Valuable migration foundation. Malformed JSON falls back to a fresh home; it does not expose a recovery copy. `house.version` exists, but there is no explicit versioned envelope governing all app state. |
| Storage failures remain usable and warn once | `src/state.js:101`, `src/main.js:228` | Good graceful degradation. A transient toast is weaker than a persistent “saved / not saved” state and export recovery. |
| Cross-tab refresh | `src/main.js:1025` | Refreshing on storage events is not concurrency control; simultaneous edits can overwrite unrelated work. This is a code-derived risk, not a reproduced race. |
| Timestamp-based focus session | `src/session.js:1`, `src/session.js:6` | Correctly avoids counting timer callbacks as elapsed time. Needs stable session ID, transition revision, and explicit completion identity before synchronization. |
| Completion updates history and coins together in memory | `src/state.js:62` | History retains only `{date, minutes}` and the latest 365 entries (`src/state.js:51`). These entries are not uniquely identifiable or necessarily 365 days. They cannot be reliably merged across devices. |
| Three rooms and free decorating | `src/house.js:5`, `src/state.js:135` | Sufficient economy to test the premise. No evidence yet that extra currencies, crafting, streaks, or furniture scarcity improve return behavior. |
| Honest local presence label and in-page mini view | `src/main.js:91`, `src/main.js:93`, `src/session.js:13` | Preserve this honesty. No account, friend graph, network availability, invitation authorization, server clock, shared occupancy, or native window exists. |

Repository file inspection found no service worker or web-app manifest. A previously loaded tab may continue working offline, but repeat offline launch is not an established product capability. The current history also cannot prove attentive work; clock-based sessions should not become a claim of verified productivity.

## Durable local state and recovery

### Select idb; keep Dexie as the alternative

IndexedDB supplies asynchronous storage and transactions. Its overlapping read/write transaction rules provide the foundation for serialized local updates; this is a concrete improvement over whole-document localStorage races. [IndexedDB specification](https://www.w3.org/TR/IndexedDB/)

**idb** closely follows IndexedDB while returning promises and exposing upgrade, blocked, blocking, termination, and transaction-completion hooks. It is compatible with ordinary JavaScript modules; no frontend framework is needed. Its repository declares ISC licensing. Choose it because the proposed schema is small and explicit, not because of an unmeasured speed or bundle-size advantage. Await `tx.done`; do not perform network requests midway through a transaction, because IndexedDB transactions can close while unrelated asynchronous work runs. [idb documentation and license](https://github.com/jakearchibald/idb)

**Dexie** is a credible replacement if indexed queries, observable data, and several migration generations make the low-level wrapper tedious. It offers declarative stores and version upgrades, and its core is Apache-2.0. Dexie core and the separately offered Dexie Cloud should not be conflated: choosing a local wrapper does not select a cloud provider. Avoid introducing both idb and Dexie. [Dexie API](https://dexie.org/docs/API-Reference), [core repository](https://github.com/dexie/Dexie.js)

Native IndexedDB without a wrapper is viable, but its callback and transaction handling increase maintenance work without a specific benefit here. Reject a WASM SQLite layer for this phase: this app does not yet need SQL joins, large analytical queries, or a portable relational engine.

### Proposed storage contract

Introduce a repository boundary around `createStateStore`, preserving pure session and house functions. Use an asynchronous hydration phase and serialized commands, then publish an immutable view snapshot to the existing UI. Do not force every Babylon frame or timer render to read a database.

Suggested stores: `meta` (schema/migration status), `homes` or `rooms` (owner-local identity and revisions), `sessions` (stable UUID and transitions), `rewardEvents` (unique completion/migration/purchase IDs), and a small `backups` rotation. An `outbox` becomes necessary only when cloud sync is implemented. A completion transaction inserts the unique completion event, updates the session, and credits the wallet together. A repeated command observes the existing event and awards zero more coins. An expansion transaction validates ownership and available coins before spending and adding its room.

Migrate the current document once, retaining its original bytes until the new database has committed and been read back. Record that legacy progress was imported; do not reconstruct the wallet from the truncated history after migration. Existing coins and purchased rooms must survive. An older application tab must close its database connection on version change or clearly request reload rather than blocking silently. Recovery must never instruct users to clear site data as the first step.

Add a versioned JSON export containing user data, schema version, export timestamp, and optional integrity checksum. Exclude authentication tokens, diagnostic logs, and transient presence. Imports should validate structure, size, catalog IDs, names, and numeric ranges, preview the home and session counts, preserve a backup, and replace only after explicit confirmation. A checksum detects accidental corruption; it does not establish authenticity. Do not let an imported coin value acquire financial meaning later.

Browser storage is generally best effort, and user deletion remains possible. Request persistence after the user invests in their home; show the result truthfully and retain export regardless. `navigator.storage.estimate()` supplies an estimate, not a reservation. IndexedDB does not remove quota failure or eviction concerns. [Browser storage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

**Acceptance:** import every supported legacy fixture twice without double credit; force a failed write and retain the old home; complete the same session concurrently in two tabs; interleave room rename and furniture movement; upgrade while an old tab is open; reject unknown future exports without replacing data; round-trip an export exactly except intentionally transient fields. These tests exercise user loss scenarios, not library implementation details.

## Offline launch and PWA

Add install metadata and a service worker only after save recovery exists. A service worker can intercept requests and serve cached assets, requires a secure context in production, and has an independent lifecycle; it is not a permanently running background timer. The persisted deadline remains the source for recomputing focus on resume. [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

**vite-plugin-pwa** is the selective build integration: it supports vanilla projects, generates manifest/worker registration, and uses Workbox. Its docs are MIT-licensed; verify the exact chosen package's license and peer-dependency compatibility with this repo's Vite 8.3.0 and Node 24 before installation. The documentation's general Vite examples are not proof that every release supports Vite 8. [Getting started](https://vite-pwa-org.netlify.app/guide/)

Follow-up: registry metadata for **1.3.0** declares MIT and explicitly includes Vite 8 in its peer range; see the [exact package shortlist](follow-up-shortlist.md). Runtime compatibility and safe update behavior still need an integration trial.

Prefer an **update prompt** after saving, with activation deferred during editing/focus, instead of an unexpected reload. The plugin explicitly distinguishes auto-update from prompt behavior. Cache versioned application assets and a navigation fallback; do not cache authenticated API responses, invitation redemption, or stale friends as though they are live. Keep visual asset caches disposable and user data separate. [Update strategies](https://vite-pwa-org.netlify.app/guide/service-worker-strategies-and-behaviors)

Offline mode should say “Your room is available offline; friends reconnect when online.” Starting, pausing, completing, decorating, and exporting remain possible. Do not promise a notification at the exact end time with the app closed. Test cold offline launch after one successful online visit, incomplete first precache, deploy during a session, stale worker plus new schema, and recoverable quota failure. Test Safari, Chromium, Firefox, and the installed experience separately; installability and desktop-window behavior vary and were not measured here.

## Accounts and synchronization

Accounts should be requested when users want cloud recovery, another device, or friends—not before they can enter their furnished studio. The first account connection needs a visible “use this home / keep cloud home / preserve both” resolution if remote data already exists. Never silently replace a local home with an empty server record or upload local task text by default.

**Supabase is the recommended first service** because Postgres can hold homes, friend relationships, invitations, access grants, and completion identities, while Auth and Realtime address the corresponding identity and connection layers. This is a fit judgment, not evidence of lower latency or cost than competitors. Apply owner/membership checks through database Row Level Security; never put a service-role key in the web build. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

Email OTP is a reasonable small private-beta choice, but email delivery is real operational work. Supabase's default SMTP is explicitly nonproduction, restricted to authorized team addresses, and currently tightly rate-limited. A production email flow needs a configured sending provider and deliverability setup. OAuth can avoid some email friction but adds provider configuration and recovery choices; select one initial path after testing intended users, rather than offering a grid of providers. [SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp), [passwordless options](https://supabase.com/docs/guides/auth/auth-email-passwordless)

Use server revisions and conditional writes for rooms. If two devices edit the same room offline, preserve a conflict copy rather than arbitrarily merging furniture arrays. First friends should visit read-only rooms; concurrent interior design introduces a substantially different synchronization problem. Send semantic changes, not the entire app document or per-frame mesh transforms.

A sync outbox needs command IDs, retries, acknowledgments, deletion tombstones, and account-scoped storage. Give session transitions a single active controller/revision or an explicit takeover flow. Two devices cannot both resume independently and silently create two authoritative versions of one session. Cosmetic offline progress can remain trusted as a product decision; do not suggest a server can retroactively verify that a person focused. Trading, purchasable currency, or competitive rewards would require a separate threat model.

## Private friends, availability, and visits

Model at least three distinct facts:

- **Connection/availability:** connecting, online, away, offline, or unknown/stale. Derived from live connections and expiration policy, not `session.running`.
- **Focus:** idle, focusing, break, optionally with a shared end time. A user can focus while unavailable; availability does not assert effort.
- **Room occupancy:** which authorized visit and seat are active. Browsing a friend's home is not itself a focus session.

Supabase Presence exchanges small client payloads and merges connected state; it explicitly is not intended for high-frequency updates. Use it for occasional state changes. Client-authored fields are claims, not proof of identity, permission, or wallet balance. If strict actor attribution is needed, bind identity through server-validated events or per-user topics rather than trusting a supplied `userId`. [Presence documentation](https://supabase.com/docs/guides/realtime/presence)

Keep several device connections under one user-level presentation. Backgrounding a studying tab should not immediately make the person offline: a healthy connection and an away preference are separate. After loss of freshness, show unknown/offline instead of an indefinitely green dot. A proposed first-beta expiry target is 60 seconds; measure it under sleep, network changes, and mobile suspension before making a promise. This is a design target, not a vendor guarantee.

Private channels need their own authorization. Database RLS alone does not automatically establish the desired Broadcast/Presence policies. Supabase documents `realtime.messages` policies and checking rights when clients join; configure private access and test connected-session revocation, because a membership removal must not merely prevent the next join. [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)

Start with explicit invitations and a small room capacity. An invitation is a high-entropy, expiring, revocable token redeemed into an authenticated membership, not permanent permission granted by knowing a room ID. Hash stored redemption tokens; limit attempts; redact them from logs/referrers. Allow host lock, leave, remove guest, block, and revoke invite. Verify blocked people cannot retrieve the room snapshot or subscribe indirectly. Visits should display a host-approved snapshot and claim seats atomically; visitors cannot edit the owner's furniture or coins. Decide explicitly whether host absence closes the visit or permits a persistent room. The first beta should use “host opens room” for comprehensible consent.

Quiet company is enough for an initial test: arrivals, a seat, focus/break indicators, and restrained optional reactions. Defer public discovery, arbitrary uploads, chat, voice/video, and direct messages until there is evidence they help focusing and capacity to handle their abuse/moderation costs.

## Alternative multiplayer choices: selective rejection

| Candidate | Verified fit | Decision / return condition |
|---|---|---|
| Supabase | Durable relational records, RLS, Auth, private Realtime presence | First proof of concept. Reconsider if live room simulation becomes the dominant requirement or authorization latency/cost fails measured targets. |
| PartyKit | JavaScript server logic, WebSockets, authentication/storage/rate-limit guides | Useful if custom authoritative room behavior grows beyond simple visits. It does not remove the need to design identity, membership, durable account records, and deletion. Its docs were last updated March 2025 on the overview; validate current deployment/support route before commitment. [Official docs](https://docs.partykit.io/) |
| Colyseus | Server-mutated room state, client commands, schema-based patch synchronization | Best reserve candidate for moving avatars, validated interactions, and authoritative multiplayer simulation. Excess structure for a few seated visitors and occasional state changes. [State synchronization](https://docs.colyseus.io/state) |
| Liveblocks | Framework-independent JavaScript client, temporary Presence, persistent shared Storage, backend-set permissions | Stronger fit if collaborative editing becomes central. Additional collaboration service is hard to justify alongside account/relational storage for owner-only decorating. React is not required. [Client API](https://liveblocks.io/docs/api-reference/liveblocks-client), [authentication](https://liveblocks.io/docs/api-reference/authentication) |

Do not combine all four. Isolate a `presenceTransport` and `visitRepository` so a later move is plausible, but avoid prematurely designing a universal multiplayer framework.

**Cost/license boundaries:** idb is ISC and Dexie core Apache-2.0 as checked above. Supabase's reviewed pricing lists Free at $0, 200 peak Realtime connections and 2 million monthly messages, with inactivity pausing; Pro begins at $25/month, with usage and additional compute potentially extra. Two tabs/devices per person change connection counts. [Supabase pricing](https://supabase.com/pricing) Liveblocks' page showed a free prototyping tier and Pro at $25/month **billed annually**, with credits; this is not a quote for Little Hours' workload. [Liveblocks pricing](https://liveblocks.io/pricing) PartyKit/Colyseus hosting costs, selected package licenses, service terms, data regions, and support commitments were not fully audited; they are decision gates, not presumed free infrastructure. No dollar-per-user estimate is defensible without measured connection duration, fan-out, message count, and retention.

## Privacy and progression are product design

Default to sharing a chosen display name/avatar, online availability, coarse focus state, and the invited room. Keep task text, session history, daily totals, exact activity timelines, and account email private. A room name can itself be sensitive. Offer an invisible mode and clear sharing preview. Do not add active-app tracking, screenshots, keystroke observation, or contact imports to establish presence.

Local storage is not encrypted protection against scripts executing in the app origin. Keep dynamic user strings out of HTML templates; validate imported/shared layouts against catalog IDs rather than arbitrary URLs or scripts. Audit every interpolation when names become remotely supplied. Add a restrictive deployment CSP compatible with actual bundled code and required endpoints. Bound payloads and join rates; exclude tokens and tasks from telemetry. Specify account deletion, local-device cleanup, export, and backup retention before promising cloud recovery. These are proposed controls, not assertions that the current deployment implements them.

The first two extensions cost 25 and 75 coins, while sessions award 25/50/90 (`src/house.js:5`, `src/house.js:13`). Thus 100 completed minutes is enough for both, across valid sessions. After this, coins have no implemented spending destination. That is an experiment boundary: interview users after the upstairs unlock rather than immediately adding a shop. Furniture being free protects self-expression; charging for it would alter the current promise.

Track a small opt-in evaluation funnel: first room personalization, first started/completed session, first extension, return on another day, second meaningful personalization, and later first successful friend visit. Compare explanations from people who return and leave; do not invent retention benchmarks. Avoid streak penalties or a pet that suffers when someone rests. Pause semantics deserve explicit copy: current code preserves remaining time and can award completion after resumption, so “paused sessions earn none” should mean no payout at the pause event, unless product intent changes. Check this wording before designing a ledger that disqualifies all paused sessions.

## Optional native Mac companion

Choose the native surface only after the shared state contract works in two browsers. **SwiftUI views in an AppKit NSPanel** are the selective Mac recommendation: a compact recognizable avatar/home cue, timer, and expandable friend list. NSPanel supports floating auxiliary-window behavior and key-window control. Determine placement from `NSScreen`, safe-area insets, and auxiliary top areas; there are no drawable pixels inside the physical camera housing. Handle non-notched displays as a normal compact panel. [NSPanel](https://developer.apple.com/documentation/appkit/nspanel?changes=l_6&language=objc), [screen geometry](https://developer.apple.com/documentation/appkit/nsscreen/safeareainsets?changes=_4), [auxiliary area](https://developer.apple.com/documentation/appkit/nsscreen/auxiliarytopleftarea-uglc?language=_1)

Use public APIs and original assets; no system HUD replacement, screen capture, accessibility monitoring, or media interception is needed for this product. A native UI can consume the same account/room/presence protocol. Full Babylon reuse would require a webview and a separate rendering evaluation; do not rebuild the entire 3D editor in Swift just to show a tiny companion. An optional native app also has separate local storage: it cannot simply read the browser's IndexedDB. Use explicit import or account sync.

**Tauri** is attractive for existing web UI reuse and scoped native permissions, but its current macOS transparent-webview API explicitly requires `macos-private-api` and warns this prevents App Store acceptance. That is a decisive constraint if a transparent notch-shaped webview and Mac App Store distribution are both required. An opaque window or native panel may change the tradeoff. [Tauri webview API](https://v2.tauri.app/reference/javascript/api/namespacewebview/), [capabilities](https://v2.tauri.app/security/capabilities/)

**Electron** offers documented frameless/transparent windows and close reuse of the web renderer. Keep it as the fallback if cross-platform desktop becomes a priority and measured resource use is acceptable. Do not claim it is too slow without testing. Package trusted local content, disable Node integration in remote content, retain context isolation/security, and narrowly validate IPC. [Window styles](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles), [security](https://www.electronjs.org/docs/latest/tutorial/security)

Test multi-monitor changes, menu-bar auto-hide, Spaces/full-screen, keyboard focus, click-through, reduced motion, sleep/wake, account revocation, and browser/native simultaneous timer control. Measure CPU, memory, energy impact, and wakeups collapsed versus expanded. Apple distribution/signing membership and selected shell licenses need an implementation-stage budget review; no native packaging benchmark or shipping estimate was verified here.

## Bounded implementation sequence and release gates

Effort below is planning judgment for one engineer familiar with the code; includes integration/testing, excludes user research recruitment, service approval, legal review, and store review.

| Slice | Likely effort | Release gate |
|---|---:|---|
| Versioned export/import and recovery UI | 2–4 days | Round-trip and malformed-input tests; old home always recoverable. |
| Transactional persistence and event identities | 4–8 days | Migration interruption, multi-tab completion, purchase atomicity, blocked upgrade tests. |
| Offline PWA | 2–4 days | Real-browser cold offline launch and safe update during focus/editing. |
| Optional account and single-owner cloud recovery | 1–2 weeks | Account switching, conflicting homes, offline retries, deletion, and no token/task leakage. |
| Invite-only friends and seated visits | 2–4 weeks | Two real clients; unauthorized access denied; expired/revoked invites; block/kick; stale presence; duplicate seat claims. |
| Mac companion feasibility prototype | 3–5 days | Real hardware/windowing and energy measurements; no shipping promise. |

Use the existing `npm test`, `npm run verify:room`, and `npm run build` gates when implementation starts. Add browser integration and backend authorization tests where their risks arise; the NullEngine room harness cannot validate offline installation, network failure, social access control, or native overlay behavior. Research alone did not require rerunning unchanged app tests.
