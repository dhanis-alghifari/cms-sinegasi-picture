import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('monthly social archives preserve legacy periods and enforce one platform-correct archive per account and month', async () => {
  const migration = await readFile(path.resolve(__dirname, '086_social_media_monthly_archive.sql'), 'utf8');

  assert.match(migration, /ADD COLUMN IF NOT EXISTS archive_month DATE/);
  assert.match(migration, /uq_social_insight_archive_account_month[\s\S]*?WHERE archive_month IS NOT NULL/);
  assert.match(migration, /archive_month IS NULL OR archive_month = date_trunc\('month', archive_month\)::DATE/);
  assert.match(migration, /WHEN v_platform = 'whatsapp' THEN v_expected_end - 29/);
  assert.match(migration, /SOCIAL_ARCHIVE_PERIOD_INVALID/);
  assert.match(migration, /SOCIAL_ARCHIVE_METRICS_INVALID/);
  assert.match(migration, /BEFORE INSERT OR UPDATE OF social_account_id, archive_month/);
  assert.match(migration, /SOCIAL_INSIGHT_EVIDENCE_REQUIRED/);
});
