# Almfrje Android APK, Downloads, and Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إنتاج APK TWA موقّع للمفرجي، ونشره برابط موثّق في صفحة تنزيل عامة، وتحديث أدلة المستخدم والإدارة والدليل التقني بكل الميزات المعتمدة.

**Architecture:** يولّد Bubblewrap مشروع Android من أصل PWA المحصن ويربط الحزمة `me.alaoufi.almfrje` بالنطاق عبر Digital Asset Links. يبني GitHub Actions الإصدار من وسم صريح، يوقعه بأسرار محمية، ينشر أصلًا مسمى بالإصدار وchecksum، ثم تشير صفحة التنزيل الثابتة إلى الإصدار المتحقق منه.

**Tech Stack:** Trusted Web Activity، Bubblewrap، Gradle/Android SDK 36، GitHub Actions/Releases، Web App Manifest، Digital Asset Links، Vanilla JavaScript، Node tests.

---

## Prerequisite gate

لا تبدأ الإصدار قبل نجاح خطط الأمان والأداء وإجراءات العضو والمراسلات وPush، ونشر نسخة الموقع المختبرة على Cloudflare. لا ينشر APK يفتح نسخة موقع ما زالت تحتوي التجاوزات الأمنية المعروفة.

## File structure

- Create `android/almfrje-twa/twa-manifest.json`: مصدر إعداد Bubblewrap المثبت.
- Create generated `android/almfrje-twa/app/*`, Gradle wrapper, and project files.
- Create `.github/workflows/almfrje-android-release.yml`: بناء وتوقيع وفحص ونشر APK.
- Create `public/.well-known/assetlinks.json`: ربط النطاق بشهادة الإصدار.
- Create `scripts/render-almfrje-assetlinks.mjs`: توليد assetlinks من البصمة العامة الفعلية بلا قيمة مؤقتة.
- Create `public/almfrje/android-release.json`: بيانات الإصدار المعروضة في الموقع.
- Modify `public/almfrje/manifest.webmanifest`: PWA/TWA metadata and PNG icons.
- Modify `public/almfrje/app.js`: شاشة `#/downloads` وروابطها وتحديث `GUIDE` و`FAQ`.
- Modify `public/almfrje/app.css`: صفحة التنزيل وتعليمات التثبيت.
- Modify `ALMFRJE_DEV_GUIDE.md`: Android، المراسلات، الصلاحيات، الإصدار والرجوع.
- Modify `.env.example`: توثيق أسرار الإشعارات دون قيم.
- Test `test/almfrje-android-config.test.mjs`.
- Test `test/almfrje-downloads-guides.test.mjs`.
- Create `docs/verification/almfrje-android-release-1.0.0.md`.

### Task 1: Make the PWA contract TWA-ready

**Files:**
- Modify: `public/almfrje/manifest.webmanifest`
- Create: `public/almfrje/android-release.json`
- Test: `test/almfrje-android-config.test.mjs`

- [ ] **Step 1: Write failing manifest/release tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('manifest is standalone and has raster maskable icons', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/almfrje/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose.includes('maskable')));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose.includes('maskable')));
});

test('release metadata is exact and has no placeholder URL', () => {
  const release = JSON.parse(fs.readFileSync(new URL('../public/almfrje/android-release.json', import.meta.url), 'utf8'));
  assert.deepEqual({ versionName: release.versionName, versionCode: release.versionCode }, { versionName: '1.0.0', versionCode: 1 });
  if (release.published) {
    assert.match(release.apkUrl, /^https:\/\/github\.com\/alaoufi\/Almfrje\/releases\/download\/almfrje-android-v1\.0\.0\/almfrje-1\.0\.0\.apk$/);
    assert.match(release.sha256, /^[a-f0-9]{64}$/);
    assert.ok(release.sizeBytes > 0);
  } else {
    assert.equal(release.apkUrl, '');
    assert.equal(release.sha256, '');
    assert.equal(release.sizeBytes, 0);
  }
});
```

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-android-config.test.mjs`

Expected: FAIL because display is `browser` and release metadata is absent.

- [ ] **Step 3: Update the manifest and add staged release metadata**

Set manifest name, short name, start/scope `/`, `display: standalone`, theme/background colors, `id: /`, and 192/512 PNG icons. During development create release metadata with `published: false`, empty `apkUrl/sha256/size`; update the test so unpublished metadata requires empty fields, while published metadata requires exact non-placeholder values.

```json
{
  "versionName": "1.0.0",
  "versionCode": 1,
  "published": false,
  "publishedAt": "",
  "apkUrl": "",
  "sizeBytes": 0,
  "sha256": "",
  "minAndroid": 23
}
```

- [ ] **Step 4: Run green and commit**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-android-config.test.mjs`

Expected: PASS for the unpublished state.

```bash
git add public/almfrje/manifest.webmanifest public/almfrje/android-release.json test/almfrje-android-config.test.mjs
git commit -m "feat: prepare Almfrje PWA for Android"
```

### Task 2: Generate and lock the TWA Android project

**Files:**
- Create: `android/almfrje-twa/twa-manifest.json`
- Create: `android/almfrje-twa/app/build.gradle`
- Create: `android/almfrje-twa/app/src/main/AndroidManifest.xml`
- Create: `android/almfrje-twa/settings.gradle`
- Create: `android/almfrje-twa/gradle.properties`
- Create: `android/almfrje-twa/gradlew`
- Create: `android/almfrje-twa/gradlew.bat`
- Create: `android/almfrje-twa/gradle/wrapper/*`
- Test: `test/almfrje-android-config.test.mjs`

- [ ] **Step 1: Extend failing config tests**

Assert package `me.alaoufi.almfrje`, host `almfrje.alaoufi.me`, start URL `/`, version 1/1.0.0, min SDK 23, target SDK 36, and that no signing passwords or keystore bytes appear in tracked files.

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-android-config.test.mjs`

Expected: FAIL because the TWA project is absent.

- [ ] **Step 3: Generate with Bubblewrap and normalize committed config**

Run from a temporary tool directory, not globally modifying the repository toolchain:

```powershell
npx --yes @bubblewrap/cli init --manifest=https://almfrje.alaoufi.me/almfrje/manifest.webmanifest
```

Set exact values in `twa-manifest.json`:

```json
{
  "packageId": "me.alaoufi.almfrje",
  "host": "almfrje.alaoufi.me",
  "name": "المفارجة",
  "launcherName": "المفارجة",
  "display": "standalone",
  "startUrl": "/",
  "appVersionName": "1.0.0",
  "appVersionCode": 1,
  "minSdkVersion": 23,
  "targetSdkVersion": 36
}
```

Commit the generated Gradle wrapper and sources but no `.jks`, `local.properties`, build output, or secrets.

- [ ] **Step 4: Build unsigned debug and inspect package metadata**

Run:

```powershell
Push-Location android/almfrje-twa
.\gradlew.bat assembleDebug --no-daemon --console=plain
Pop-Location
```

Expected: `BUILD SUCCESSFUL`; `aapt dump badging` reports package `me.alaoufi.almfrje`, versionCode 1, versionName 1.0.0.

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: all tests pass.

```bash
git add android/almfrje-twa test/almfrje-android-config.test.mjs .gitignore
git commit -m "feat: add Almfrje trusted web Android shell"
```

### Task 3: Bind the production certificate with Digital Asset Links

**Files:**
- Create: `public/.well-known/assetlinks.json`
- Create: `scripts/render-almfrje-assetlinks.mjs`
- Modify: `test/almfrje-android-config.test.mjs`

- [ ] **Step 1: Add failing asset-links tests**

Assert one relation `delegate_permission/common.handle_all_urls`, namespace `android_app`, package name, and a 32-byte SHA-256 certificate fingerprint formatted as colon-separated uppercase hex. Assert no debug fingerprint.

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-android-config.test.mjs`

Expected: FAIL because assetlinks is missing.

- [ ] **Step 3: Generate the production signing key offline and record recovery material**

Generate one release keystore with `keytool`, store it outside the repository in an encrypted backup, and add base64 keystore plus alias/store/key passwords to GitHub Secrets:

```text
ALMFRJE_ANDROID_KEYSTORE_B64
ALMFRJE_ANDROID_KEY_ALIAS
ALMFRJE_ANDROID_STORE_PASSWORD
ALMFRJE_ANDROID_KEY_PASSWORD
```

Do not paste values into logs, docs, commits, or chat.

- [ ] **Step 4: Add a validated assetlinks renderer**

Create `scripts/render-almfrje-assetlinks.mjs`:

```js
import fs from 'node:fs';
const fingerprint = String(process.env.ALMFRJE_CERT_SHA256 || '').trim().toUpperCase();
if (!/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fingerprint)) throw new Error('ALMFRJE_CERT_SHA256 must be a 32-byte colon-separated SHA-256 fingerprint');
const body = [{
  relation: ['delegate_permission/common.handle_all_urls'],
  target: { namespace: 'android_app', package_name: 'me.alaoufi.almfrje', sha256_cert_fingerprints: [fingerprint] },
}];
fs.mkdirSync(new URL('../public/.well-known/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../public/.well-known/assetlinks.json', import.meta.url), JSON.stringify(body, null, 2) + '\n');
```

Use `keytool -list -v` on the release keystore, copy its SHA-256 certificate fingerprint into the process-only environment variable `ALMFRJE_CERT_SHA256`, and run `node scripts/render-almfrje-assetlinks.mjs`. The renderer refuses blank, truncated, or malformed values, so no placeholder can be committed.

- [ ] **Step 5: Test the public file after staging deployment and commit**

Run: `curl.exe -fsS https://almfrje.alaoufi.me/.well-known/assetlinks.json`

Expected: HTTP 200 JSON with the exact package and actual fingerprint.

```bash
git add public/.well-known/assetlinks.json scripts/render-almfrje-assetlinks.mjs test/almfrje-android-config.test.mjs
git commit -m "feat: bind Almfrje Android app to its domain"
```

### Task 4: Build, sign, verify, and publish releases in CI

**Files:**
- Create: `.github/workflows/almfrje-android-release.yml`
- Modify: `test/almfrje-android-config.test.mjs`

- [ ] **Step 1: Add failing workflow tests**

Assert the workflow triggers only on `almfrje-android-v*` tags or manual dispatch, sets up Java and Android SDK 36, decodes the keystore from a secret, builds release, verifies with `apksigner`, captures `aapt` metadata, writes SHA-256, and publishes both APK and checksum. Assert it has no `pull_request` release trigger.

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-android-config.test.mjs`

Expected: FAIL because workflow is absent.

- [ ] **Step 3: Implement the guarded workflow**

Use pinned major actions and explicit permissions:

```yaml
name: Almfrje Android Release
on:
  workflow_dispatch:
  push:
    tags: ['almfrje-android-v*']
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'
          cache: gradle
      - uses: android-actions/setup-android@v3
      - run: sdkmanager 'platforms;android-36' 'build-tools;36.0.0'
      - name: Decode signing keystore
        env:
          KEYSTORE_B64: ${{ secrets.ALMFRJE_ANDROID_KEYSTORE_B64 }}
        run: printf '%s' "$KEYSTORE_B64" | base64 --decode > android/almfrje-twa/release.jks
      - working-directory: android/almfrje-twa
        env:
          ALMFRJE_ANDROID_KEY_ALIAS: ${{ secrets.ALMFRJE_ANDROID_KEY_ALIAS }}
          ALMFRJE_ANDROID_STORE_PASSWORD: ${{ secrets.ALMFRJE_ANDROID_STORE_PASSWORD }}
          ALMFRJE_ANDROID_KEY_PASSWORD: ${{ secrets.ALMFRJE_ANDROID_KEY_PASSWORD }}
        run: ./gradlew assembleRelease --no-daemon --console=plain
```

Add steps that copy to `almfrje-1.0.0.apk`, run `apksigner verify --verbose --print-certs`, run `aapt dump badging`, generate `sha256sum`, create the release if absent, and upload immutable assets. Always delete `release.jks` in an `if: always()` step.

- [ ] **Step 4: Run tests and commit**

Run: `npm test`

Expected: all tests pass.

```bash
git add .github/workflows/almfrje-android-release.yml test/almfrje-android-config.test.mjs
git commit -m "ci: publish verified Almfrje Android releases"
```

### Task 5: Add the public downloads screen

**Files:**
- Modify: `public/almfrje/app.js`
- Modify: `public/almfrje/app.css`
- Test: `test/almfrje-downloads-guides.test.mjs`

- [ ] **Step 1: Write failing downloads tests**

Assert route `#/downloads`, access before authentication, links from auth and More, escaped release JSON rendering, disabled download button when `published=false`, and published fields version/date/size/SHA/source/install steps.

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-downloads-guides.test.mjs`

Expected: FAIL because downloads screen is absent.

- [ ] **Step 3: Implement release metadata loading and the screen**

Fetch `/almfrje/android-release.json` with `cache: 'no-store'`. If unpublished or invalid, show `نسخة Android قيد التجهيز` and no external button. If published, render only after checking HTTPS GitHub host, exact repository path/tag pattern, 64-hex SHA, positive size, and matching version.

Include numbered install steps, Android warning explanation, notification permission instructions, update behavior, checksum copy button, and link to GitHub release notes.

- [ ] **Step 4: Link the screen before and after login**

Add `تنزيل تطبيق Android` to the authentication screen and account group in More. Do not require tree data or member session to render downloads.

- [ ] **Step 5: Run syntax/tests and commit**

Run:

```powershell
node --check public/almfrje/app.js
node --no-warnings --experimental-strip-types --test test/almfrje-downloads-guides.test.mjs
```

Expected: both pass.

```bash
git add public/almfrje/app.js public/almfrje/app.css test/almfrje-downloads-guides.test.mjs
git commit -m "feat: add verified Android downloads page"
```

### Task 6: Update user, administration, FAQ, and technical guides

**Files:**
- Modify: `public/almfrje/app.js`
- Modify: `ALMFRJE_DEV_GUIDE.md`
- Modify: `test/almfrje-downloads-guides.test.mjs`

- [ ] **Step 1: Extend failing guide coverage tests**

Require exact topics in the user guide: APK installation/update, notification permission, direct messages, no groups, participant-only privacy, block/report, self/father/children edits, own-child addition/reorder, own undo, visit meaning. Require admin guide topics: action banner, shared supervisor decisions, five permissions including `approve_members`, audit/revert, reported-message-only moderation, push secrets, backup/rollback. Require technical guide tables/routes/worker/release workflow.

- [ ] **Step 2: Run red**

Run: `node --no-warnings --experimental-strip-types --test test/almfrje-downloads-guides.test.mjs`

Expected: FAIL listing missing guide topics.

- [ ] **Step 3: Update the in-app user guide and FAQ**

Add these exact headings and meanings to `GUIDE`/`FAQ`, using the actual navigation labels implemented by the preceding tasks:

- `تنزيل تطبيق Android`: open `التنزيلات`, download the signed APK, allow installation from the current browser only when Android asks, install, then disable that allowance if desired. Updates install over the prior copy only when the signature matches and `versionCode` is newer.
- `إشعارات الرسائل`: permission is requested only after pressing `تفعيل إشعارات الرسائل`; denying it never prevents reading or sending messages.
- `التنبيهات التعريفية`: password advice appears once per account after acknowledgement; automatic site-install advice appears once per browser profile and stays hidden in installed mode. Password changes remain available in the profile and manual installation remains available in More. Follow Task 8 of the member-actions plan for server persistence, retries, and legacy dismissals; do not reset these markers during the APK/PWA update.
- `المراسلات الفردية`: every conversation is between exactly two active linked members; there are no groups, admins cannot read normal conversation content, and only the reported message snapshot becomes visible to moderation.
- `الحظر والإبلاغ`: blocking stops new messages in both directions without erasing history; reporting sends the selected message snapshot and reason, not the full conversation.
- `تعديل بيانات الأسرة المباشرة`: a linked member may edit only self, father, and direct children; may add only own direct child and reorder only own direct children; no approval is needed and every change is audited.
- `التراجع عن تعديل`: the member may revert only their own eligible change when no newer conflicting edit exists; authorized administration may revert only within its action and branch permission.
- `كيف تحسب الزيارة؟`: one future visit is counted once per browser-tab session after successful entry; historical totals remain unchanged.

Replace the old FAQ answer that says all newborns require administrative approval with: `يضيف العضو مولوده المباشر دون موافقة، أما طلبات الإضافة الأخرى فتخضع لصلاحية الإضافة أو الاعتماد ونطاق الفرع.` Replace wording that calls the PWA shortcut an installed Android app; distinguish `إضافة إلى الشاشة الرئيسية` from the signed APK.

- [ ] **Step 4: Update administration and technical guides**

Add an administration table mapping `add_birth`, `approve_birth`, `reorder`, `edit_profile`, and explicit `approve_members` to the matching action and branch boundary. State that several supervisors may see the same eligible request and the first terminal decision wins; permanent request deletion remains admin-only. Add sections named `سجل التعديلات والتراجع`, `خصوصية الرسائل والبلاغات`, and `النسخ الاحتياطي والرجوع قبل التفعيل` with the exact rules from the approved specs.

In `ALMFRJE_DEV_GUIDE.md`, document the new tables, four transactional messaging RPCs, member-action/revert/visit RPCs, API action contracts, `almfrje-sw.js`, three VAPID environment variables, TWA package/version fields, signing-secret names, `assetlinks.json`, tag format `almfrje-android-v<version>`, release verification commands, backup/rollback order, and public verification URLs. Remove outdated claims that RLS already guarantees properties the new tests are meant to enforce.

- [ ] **Step 5: Run checks and commit**

Run:

```powershell
node --check public/almfrje/app.js
npm test
npm run check:boundaries
```

Expected: all pass.

```bash
git add public/almfrje/app.js ALMFRJE_DEV_GUIDE.md test/almfrje-downloads-guides.test.mjs
git commit -m "docs: update Almfrje user and admin guides"
```

### Task 7: Produce and verify Android 1.0.0

**Files:**
- Modify: `public/almfrje/android-release.json`
- Create: `docs/verification/almfrje-android-release-1.0.0.md`

- [ ] **Step 1: Run the complete web gate**

Run:

```powershell
node --check public/almfrje/app.js
npm test
npm run check:boundaries
npm run build
```

Expected: all exit 0; record test count and `.next/BUILD_ID`.

- [ ] **Step 2: Create the rollback point and deploy the verified web prerequisites**

Create a database backup, encrypted signing-key backup confirmation, and Git rollback tag. Deploy the site containing manifest, Service Worker, messages, downloads-unpublished state, and assetlinks. Verify public fingerprints/assets and the security matrix before tagging Android.

- [ ] **Step 3: Trigger the release workflow**

Create signed tag `almfrje-android-v1.0.0` on the verified commit and push it. Wait for the workflow to complete. If any build/sign/metadata step fails, do not publish or update downloads.

- [ ] **Step 4: Download and independently verify the published artifact**

Download `almfrje-1.0.0.apk` and checksum from GitHub Release. Run:

```powershell
Get-FileHash -Algorithm SHA256 .\almfrje-1.0.0.apk
apksigner verify --verbose --print-certs .\almfrje-1.0.0.apk
aapt dump badging .\almfrje-1.0.0.apk
```

Expected: hash equals published checksum; signing verifies; package/version exactly `me.alaoufi.almfrje`, 1, 1.0.0; certificate fingerprint equals assetlinks.

- [ ] **Step 5: Test install, update, TWA verification, and push**

Install on an Android 6+ emulator/device, confirm full-screen verified TWA, login, send/receive direct message, close app, receive generic notification, and tap to open the right conversation. Install a second build with versionCode 2 signed by the same temporary release key in an isolated rehearsal to prove update-in-place before publishing future updates.

- [ ] **Step 6: Publish the downloads metadata**

Set `published=true`, exact release URL, byte size, UTC publication time, and lowercase SHA-256 in `android-release.json`. Run the metadata test, commit, deploy, and verify `#/downloads` from a logged-out browser downloads the exact verified asset.

- [ ] **Step 7: Record evidence and commit**

Record workflow run, tag, commit, package/version, certificate fingerprint, SHA-256, APK size, install device/API, TWA verification, push test, live download URL, backup, and rollback tag.

```bash
git add public/almfrje/android-release.json docs/verification/almfrje-android-release-1.0.0.md
git commit -m "release: publish Almfrje Android 1.0.0 metadata"
```

- [ ] **Step 8: Final public verification**

Fetch the live site, manifest, Service Worker, assetlinks, release JSON, and APK URL. Confirm the live asset fingerprints match the release commit. Do not report completion until the downloaded APK passes hash, signature, package, version, install, and notification checks.
