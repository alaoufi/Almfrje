// Usage: node scripts/verify-home-notices.cjs <path-to-playwright>
const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('public/almfrje/app.js', 'utf8').replace(/^init\(\);\s*$/m, '');
const css = fs.readFileSync('public/almfrje/app.css', 'utf8');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.route('**/*', r => r.fulfill({ contentType: 'text/html', body: '<html dir="rtl"><body><main id="view"></main></body></html>' }));
    await page.goto('https://fixture.test');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: source });
    await page.evaluate(() => {
      me = { user_id: 'member-a', full_name: 'اختبار', role: 'viewer', is_active: true };
      C.persons = [{ id: 1, name: 'اختبار', generation: 1, status: 'alive' }];
      C.branches = []; recentShow = false; tribeDocs = []; bannerText = '';
      pingPresence = async () => {}; loadMyReplies = async () => {};
      window.mockAccount = { id: 'member-a', user_metadata: {} };
      sb = { auth: {
        getUser: async () => ({ data: { user: window.mockAccount } }),
        updateUser: async ({ data }) => { Object.assign(window.mockAccount.user_metadata, data); return { error: null }; },
      } };
      visitStats.total = 1308;
      screenHome();
    });
    assert.equal(await page.locator('.home-stats .stat').count(), 3);
    assert.equal(await page.locator('#visitsTotal').count(), 0);
    await page.waitForFunction(() => window.mockAccount.user_metadata.password_notice_seen_at);
    await page.evaluate(() => { visitStats.total = 1309; document.querySelector('.vstats').open = true; updateOnlineDom(); });
    assert.equal(await page.locator('.vstats-total').textContent(), '1309');
    assert.equal(await page.locator('.vstats').evaluate(el => el.open), true);
    await page.evaluate(() => screenHome());
    assert.equal(await page.locator('.notice-pw').count(), 0);
    // Simulate a fresh device with the same account's server metadata.
    await page.evaluate(() => { localStorage.clear(); pwNoticeSeen.clear(); pwNoticeSynced.clear(); restorePwNotice(window.mockAccount); screenHome(); });
    assert.equal(await page.locator('.notice-pw').count(), 0);
    // A different account does not inherit the first account's notice state.
    assert.equal(await page.evaluate(() => { me.user_id = 'member-b'; return pwChanged(); }), false);
    await page.evaluate(() => { showInstallBar('تثبيت', null); });
    assert.equal(await page.locator('#installBar').count(), 1);
    await page.evaluate(() => { document.getElementById('installBar').remove(); _installPromptSeen = false; showInstallBar('تثبيت', null); });
    assert.equal(await page.locator('#installBar').count(), 0);
    for (const width of [390, 760, 1024, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      const boxes = await page.locator('.home-stats .stat').evaluateAll(els => els.map(el => ({ top: el.getBoundingClientRect().top })));
      if (width >= 760) {
        assert.equal(new Set(boxes.map(b => b.top)).size, 1);
        const top = await page.locator('.home-quick-row > *').evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
        assert.equal(top[0], top[1]);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    console.log('PASS: three-card responsive layout, live visit update, account notice persistence, account separation, one-time installation advice.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
