import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const domainRules = [
  {
    file: 'src/features/contests/types/contests.types.ts',
    responsibility: 'contest domain values',
    required: [
      { name: 'work-type values', pattern: /WORK_TYPE_VALUES/ },
      { name: 'entry-status values', pattern: /CONTEST_ENTRY_STATUS_VALUES/ },
      { name: 'outcome-status values', pattern: /CONTEST_OUTCOME_STATUS_VALUES/ },
    ],
  },
  {
    file: 'src/features/contests/utils/contestLabels.ts',
    responsibility: 'contest labels and options',
    required: [
      { name: 'work-type options', pattern: /CONTEST_WORK_TYPE_OPTIONS/ },
      { name: 'entry-status options', pattern: /CONTEST_ENTRY_STATUS_OPTIONS/ },
      { name: 'outcome-status options', pattern: /CONTEST_OUTCOME_STATUS_OPTIONS/ },
      { name: 'achievement formatter', pattern: /getContestResultDisplayLabel/ },
    ],
  },
  {
    file: 'src/features/contests/components/ContestAchievementsPanel.tsx',
    responsibility: 'achievement presentation',
    forbidden: [
      { name: 'local result-kind catalog', pattern: /const\s+RESULT_KIND_OPTIONS/ },
      { name: 'local outcome catalog', pattern: /const\s+OUTCOME_OPTIONS/ },
      { name: 'local result formatter', pattern: /function\s+resultLabel/ },
      { name: 'unchecked result-kind cast', pattern: /as\s+ContestResultKind/ },
      { name: 'unchecked outcome cast', pattern: /as\s+ContestOutcomeStatus/ },
    ],
  },
  {
    file: 'src/features/contests/hooks/useContestWorkTypesQuery.ts',
    responsibility: 'work-type query',
    forbidden: [
      { name: 'local work-type fallback catalog', pattern: /FALLBACK_WORK_TYPES/ },
    ],
  },
  {
    file: 'src/features/contests/api/contests.responses.ts',
    responsibility: 'contest response schemas',
    forbidden: [
      {
        name: 'duplicated outcome literals',
        pattern: /z\.enum\(\['pending',\s*'awarded',\s*'not_awarded'\]\)/,
      },
    ],
  },
  {
    file: 'src/features/contests/utils/contestPipelineRules.ts',
    responsibility: 'pure pipeline rules',
    forbidden: [
      { name: 'presentation label catalog', pattern: /RESULT_KIND_(OPTIONS|LABELS)/ },
      { name: 'outcome label catalog', pattern: /OUTCOME_STATUS_(OPTIONS|LABELS)/ },
    ],
  },
];

const violations = [];

for (const rule of domainRules) {
  const filePath = resolve(rule.file);
  if (!existsSync(filePath)) {
    violations.push(rule.file + ': file untuk ' + rule.responsibility + ' tidak ditemukan');
    continue;
  }

  const source = readFileSync(filePath, 'utf8');
  for (const forbiddenRule of rule.forbidden ?? []) {
    if (forbiddenRule.pattern.test(source)) {
      violations.push(rule.file + ': ' + forbiddenRule.name);
    }
  }
  for (const requiredRule of rule.required ?? []) {
    if (!requiredRule.pattern.test(source)) {
      violations.push(rule.file + ': katalog ' + requiredRule.name + ' hilang');
    }
  }
}

if (violations.length > 0) {
  console.error('Domain DRY checks failed:');
  for (const violation of violations) console.error('- ' + violation);
  process.exitCode = 1;
} else {
  console.log('Domain DRY checks passed for ' + domainRules.length + ' contests modules.');
}
