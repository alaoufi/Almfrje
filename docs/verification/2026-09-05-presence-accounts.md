# Online presence counts accounts — 2026-09-05

The existing endpoint keyed presence by the browser's `clientId`, so one account on two devices counted twice and two accounts sharing a client ID could overwrite each other. Presence now uses the authenticated account UUID. Identical display names remain separate accounts. Display name and branch are resolved from stored membership/person data, and client identity fields are ignored. Names remain restricted to administrators/general managers through this endpoint.

The transient presence map retains the existing three-minute TTL. Any device refreshes its account's entry. Legacy device entries have no trustworthy account identity, so they are removed as current users heartbeat again (normally within 60 seconds for visible pages). Only transient presence is rebuilt; historical visit totals and the existing visit/session-counting rule are unchanged. The underlying shared JSON presence storage remains in use; broader atomic visit/presence storage work is outside this patch.

The actual TypeScript route is exercised by `test/almfrje-presence.test.mjs` with mocked Auth/database boundaries and no production user records. Before the fix, five of six tests failed, including 2 instead of 1 for two devices. After the fix all six pass: account deduplication, distinct accounts with the same name/client ID, transition from device keys, TTL refresh/expiry, unauthorized/inactive callers and name visibility, and database read/write failures. This is not a claim of a two-device production account test.

Deployment verification requires a successful backup, rollback tag, all tests, production build, Cloudflare check success, and the live unauthenticated endpoint returning HTTP 401 with `X-Almfrje-Presence: account-v1`.

Pre-release verification passed: 15/15 tests, project-boundary check, and Next.js production build. Backup run `33925260251` completed successfully. Rollback source is `d434076a5a90b5d3b4381e5866610ac071f847fa`, tagged `backup/pre-account-presence-20260905`.
