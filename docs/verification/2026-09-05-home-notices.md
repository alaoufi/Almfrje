# Home layout and notice release — 2026-09-05

Implemented the approved three-card home layout, removal of the duplicate visitor card, live updates of the lower visits total, and one-time password/install advice. Historical visit counters and visit-recording rules are unchanged in this release.

Password advice uses the existing Supabase Auth `user_metadata.password_notice_seen_at` preference, read with `auth.getUser()` and written with the authenticated user's `auth.updateUser()`. This replaces the planned new membership column and endpoint, avoids a schema migration, and never participates in permission checks. Local account-specific markers preserve prior dismissals and pending acknowledgements; installation uses a browser-specific marker with an in-memory fallback. Browser storage clearing can reset installation advice.

Verification: `scripts/verify-home-notices.cjs` runs the actual app functions in headless Edge with synthetic account data and no production requests. It verifies three cards, removal of the duplicate, 1308→1309 display update while preserving expanded details, account notice persistence, account separation, installation advice on first display, and layouts at 390/760/1024/1366 pixels. Cross-device Auth persistence is exercised with mocked Auth responses, not two real production accounts.

The existing nine tests and project-boundary checks passed; Next.js production build passed. Asset query version is `20260905a`.

Pre-release database backup: GitHub Actions run `33924344395`, successful. Production source rollback commit: `3710997e1faa3612aaaa254d91b1b8b4bd91c73b`.

Remaining approved work includes deep permissions hardening, direct family edits/reverts, action banners, future-visit atomic recording, full startup performance work, direct messaging/push, APK and complete guide updates. This release does not claim those features are implemented.
