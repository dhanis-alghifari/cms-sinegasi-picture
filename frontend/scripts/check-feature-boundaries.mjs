import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const boundaryRules = [
  {
    file: 'src/features/contests/components/ContestEntriesDialog.tsx',
    responsibility: 'dialog orchestrator',
    forbidden: [
      { name: 'form state ownership', pattern: /\buse(Form|Watch)\b/ },
      { name: 'mutation ownership', pattern: /\buse(Create|Transition|Finalize)ContestEntryMutation\b/ },
    ],
  },
  {
    file: 'src/features/contests/utils/contestPipelineRules.ts',
    responsibility: 'pure pipeline rules',
    forbidden: [
      { name: 'React dependency', pattern: /from ['"]react['"]/ },
      { name: 'UI dependency', pattern: /shared\/ui/ },
      { name: 'mutation dependency', pattern: /\buse[A-Z][A-Za-z]+Mutation\b/ },
    ],
  },
  {
    file: 'src/features/contests/components/ContestEntryList.tsx',
    responsibility: 'entry list presentation',
    forbidden: [
      { name: 'mutation ownership', pattern: /\buse[A-Z][A-Za-z]+Mutation\b/ },
    ],
  },
  {
    file: 'src/features/contests/components/ContestAwardResultFields.tsx',
    responsibility: 'award-result compound component',
    required: [
      { name: 'Header subcomponent', pattern: /Header:\s*typeof ContestAwardResultFieldsHeader/ },
      { name: 'List subcomponent', pattern: /List:\s*typeof ContestAwardResultFieldsList/ },
      { name: 'shared context', pattern: /createContext<ContestAwardResultFieldsContextValue/ },
    ],
  },
  {
    file: 'src/features/contests/components/ContestPipelineUpdateForm.tsx',
    responsibility: 'award-result compound component usage',
    required: [
      { name: 'Header usage', pattern: /<ContestAwardResultFields\.Header\s*\/>/ },
      { name: 'List usage', pattern: /<ContestAwardResultFields\.List\s*\/>/ },
    ],
  },
];

const violations = [];

for (const rule of boundaryRules) {
  const filePath = resolve(rule.file);
  if (!existsSync(filePath)) {
    violations.push(rule.file + ': file untuk ' + rule.responsibility + ' tidak ditemukan');
    continue;
  }

  const source = readFileSync(filePath, 'utf8');
  for (const forbiddenDependency of rule.forbidden ?? []) {
    if (forbiddenDependency.pattern.test(source)) {
      violations.push(rule.file + ': ' + forbiddenDependency.name);
    }
  }
  for (const requiredContract of rule.required ?? []) {
    if (!requiredContract.pattern.test(source)) {
      violations.push(rule.file + ': kontrak ' + requiredContract.name + ' hilang');
    }
  }
}

if (violations.length > 0) {
  console.error('Feature boundary checks failed:');
  for (const violation of violations) console.error('- ' + violation);
  process.exitCode = 1;
} else {
  console.log('Feature boundary checks passed for ' + boundaryRules.length + ' contests modules/contracts.');
}
