import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const reviewedFiles = [
  'src/features/contests/pages/ContestsPage.tsx',
  'src/features/contests/components/CreateContestModal.tsx',
  'src/features/contests/components/ContestEntriesDialog.tsx',
];

const forbiddenNames = [
  { name: 'generic form handler', pattern: /\bconst handleSubmit\b/ },
  { name: 'generic submit handler', pattern: /\bconst submit(Create|Transition)\b/ },
  { name: 'ambiguous selected level state', pattern: /\bconst selectedLevel\b/ },
  { name: 'ambiguous selected type state', pattern: /\bconst selectedType\b/ },
  { name: 'generic mutation variable', pattern: /\bconst (create|update|transition|finalize)Mutation\b/ },
  { name: 'ambiguous transition helper', pattern: /\bconst startTransition\b/ },
  { name: 'ambiguous result-row factory', pattern: /\bconst newResultRow\b/ },
];

const failures = [];

for (const relativeFile of reviewedFiles) {
  const filePath = resolve(relativeFile);
  const source = readFileSync(filePath, 'utf8');

  for (const forbiddenName of forbiddenNames) {
    if (forbiddenName.pattern.test(source)) {
      failures.push(relativeFile + ': ' + forbiddenName.name);
    }
  }
}

if (failures.length > 0) {
  console.error('Storytelling code checks failed:');
  for (const failure of failures) console.error('- ' + failure);
  process.exitCode = 1;
} else {
  console.log('Storytelling code checks passed for ' + reviewedFiles.length + ' reviewed files.');
}
