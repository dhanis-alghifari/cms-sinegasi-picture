#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedDirectory = /(?:^|\/)(?:node_modules|dist|build|build-check[^/]*)(?:\/|$)/;
const localMetadataDirectory = /(?:^|\/)(?:\.aws|\.ssh|\.codegraph|\.codex|\.agents|\.ngodingpakeai)(?:\/|$)|^supabase\/(?:\.temp|\.branches)\//;
const privateFilename = /(?:\.(?:pem|key|p12|pfx|age|dump|backup|sqlite3?|db)|\.sql\.(?:gz|zip)|\.(?:custody|auth-attempt|auth-verification-attempt)\.json)$|^(?:first-teacher\.|approval\.).*\.json$/i;
const developmentHost = /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:pages\.dev|duckdns\.org|r2\.dev)\b/i;

/** Checks names only; never opens environment files, credentials, or dumps. */
export function findPathViolations(files) {
  const violations = [];
  const caseInsensitivePaths = new Map();
  for (const file of files) {
    const basename = file.split('/').at(-1);
    if ((/^\.env(?:\.|$)/i.test(basename) || /\.env(?:\.|$)/i.test(basename))
        && basename !== '.env.example') {
      violations.push(`${file}: private environment file`);
    }
    if (generatedDirectory.test(file)) violations.push(`${file}: generated output/dependency directory`);
    if (localMetadataDirectory.test(file) || file.startsWith('ops/private/')) {
      violations.push(`${file}: local/private metadata directory`);
    }
    if (privateFilename.test(basename)) violations.push(`${file}: private custody/credential/backup filename`);
    const normalized = file.toLowerCase();
    const previous = caseInsensitivePaths.get(normalized);
    if (previous && previous !== file) violations.push(`${file}: case collision with ${previous}`);
    caseInsensitivePaths.set(normalized, file);
  }
  return violations;
}

/** Public onboarding must not advertise a live development/storage hostname. */
export function findReadmeViolations(file, source) {
  return source.split(/\r?\n/).flatMap((line, index) =>
    developmentHost.test(line) ? [`${file}:${index + 1}: development/storage hostname in README`] : []);
}

export function checkRepository(root = repositoryRoot) {
  const gitFiles = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  const deleted = new Set(gitFiles(['ls-files', '--deleted', '-z']));
  // Include proposed local deletions without pretending the index is already committed.
  const files = gitFiles(['ls-files', '-z']).filter((file) => !deleted.has(file));
  const violations = findPathViolations(files);
  const readmes = new Set([
    ...files.filter((file) => /(?:^|\/)README\.md$/.test(file)),
    'README.md', 'backend/README.md', 'frontend/README.md', 'ops/README.md',
  ]);
  for (const file of readmes) {
    const filename = resolve(root, file);
    if (!existsSync(filename)) {
      violations.push(`${file}: missing README`);
      continue;
    }
    const source = readFileSync(filename, 'utf8');
    violations.push(...findReadmeViolations(file, source));
    for (const match of source.matchAll(/(?<!!)\[[^\]\n]+\]\(([^\s)]+)\)/g)) {
      const target = match[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
      const path = target.split('#')[0];
      if (!existsSync(resolve(dirname(filename), path))) {
        violations.push(`${file}: missing relative link target ${path}`);
      }
    }
  }
  return { filesChecked: files.length, readmesChecked: readmes.size, violations };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkRepository();
  if (result.violations.length > 0) {
    for (const violation of result.violations) console.error(violation);
    process.exitCode = 1;
  } else {
    console.log(`Repository hygiene passed: ${result.filesChecked} tracked paths, ${result.readmesChecked} READMEs. No env/credential contents read.`);
  }
}
