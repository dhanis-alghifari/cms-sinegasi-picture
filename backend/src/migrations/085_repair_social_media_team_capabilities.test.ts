import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('Humas capability repair grants menu access and keeps account management restricted', async () => {
  const sql = await readFile(path.resolve(__dirname, '085_repair_social_media_team_capabilities.sql'), 'utf8');

  assert.match(sql, /VALUES \('social_media_team', 'Tim Humas'\)/);
  assert.match(sql, /'social_media\.read'/);
  assert.match(sql, /SELECT 'teacher', permission_key/);
  assert.match(sql, /'social_media\.publications\.manage'/);
  assert.match(sql, /'social_media\.metrics\.manage'/);
  assert.match(sql, /DELETE FROM public\.access_role_permissions[\s\S]*'social_media\.accounts\.manage'/);
  assert.match(sql, /BEGIN;[\s\S]*COMMIT;/);
});
