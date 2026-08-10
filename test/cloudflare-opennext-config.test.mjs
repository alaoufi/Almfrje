import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import test from 'node:test';

test('includes the OpenNext Cloudflare configuration required by Workers builds', async () => {
  const configPath = new URL('../open-next.config.ts', import.meta.url);
  await access(configPath, constants.R_OK);

  const config = await readFile(configPath, 'utf8');
  assert.match(config, /defineCloudflareConfig/);
  assert.match(config, /@opennextjs\/cloudflare/);
});

test('configures the generated OpenNext worker with Node compatibility', async () => {
  const wranglerPath = new URL('../wrangler.jsonc', import.meta.url);
  await access(wranglerPath, constants.R_OK);

  const config = await readFile(wranglerPath, 'utf8');
  assert.match(config, /\.open-next\/worker\.js/);
  assert.match(config, /nodejs_compat/);
  assert.match(config, /\.open-next\/assets/);
});

test('keeps generated OpenNext output out of Git', async () => {
  const gitignorePath = new URL('../.gitignore', import.meta.url);
  const gitignore = await readFile(gitignorePath, 'utf8');
  assert.match(gitignore, /^\.open-next\/$/m);
});
