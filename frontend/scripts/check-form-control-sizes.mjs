import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'src');
const primitiveRoot = path.join(sourceRoot, 'shared', 'ui', 'primitives');
const violations = [];

async function collectFiles(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return collectFiles(entryPath, extension);
    return entry.isFile() && entry.name.endsWith(extension) ? [entryPath] : [];
  }));

  return nestedFiles.flat();
}

const inputPath = path.join(primitiveRoot, 'input.tsx');
const selectPath = path.join(primitiveRoot, 'select.tsx');
const buttonPath = path.join(primitiveRoot, 'button.tsx');
const [inputSource, selectSource, buttonSource] = await Promise.all([
  readFile(inputPath, 'utf8'),
  readFile(selectPath, 'utf8'),
  readFile(buttonPath, 'utf8'),
]);

const primitiveContracts = [
  [inputSource, 'h-[var(--control-height-mobile)]', 'Input wajib memakai token mobile.'],
  [inputSource, 'md:h-[var(--control-height-desktop)]', 'Input wajib memakai token desktop.'],
  [selectSource, 'data-[size=default]:h-[var(--control-height-mobile)]', 'Select default wajib memakai token mobile.'],
  [selectSource, 'md:data-[size=default]:h-[var(--control-height-desktop)]', 'Select default wajib memakai token desktop.'],
  [buttonSource, 'h-[var(--control-height-mobile)]', 'Button wajib memakai token mobile.'],
  [buttonSource, 'md:h-[var(--control-height-desktop)]', 'Button default wajib memakai token desktop.'],
];

for (const [source, contract, message] of primitiveContracts) {
  if (!source.includes(contract)) violations.push(message);
}

const defaultInputClasses = inputSource.match(
  /density === "compact"[\s\S]{0,120}: "([^"]+)"/,
)?.[1] ?? '';

if (defaultInputClasses.includes('md:h-8')) {
  violations.push('Input default tidak boleh memakai md:h-8.');
}

if (selectSource.includes('data-[size=default]:h-12')) {
  violations.push('Select default tidak boleh kembali ke tinggi 48px pada desktop.');
}

const featureFiles = await collectFiles(path.join(sourceRoot, 'features'), '.tsx');
const mixedFeatureFiles = [];
let localCompactInputCount = 0;

for (const filePath of featureFiles) {
  const source = await readFile(filePath, 'utf8');
  if (source.includes('<Input') && source.includes('<SelectTrigger')) {
    mixedFeatureFiles.push(filePath);
  }

  const inputMatches = source.match(/<Input\b[\s\S]{0,800}?\bmd:h-(?:6|7|8)\b/g) ?? [];
  localCompactInputCount += inputMatches.length;
}

if (localCompactInputCount > 0) {
  violations.push(
    'Ditemukan ' + localCompactInputCount + ' Input feature dengan md:h-6/7/8; gunakan varian primitive yang konsisten.',
  );
}

if (violations.length > 0) {
  console.error('Form control size check gagal:\n');
  for (const violation of violations) console.error('- ' + violation);
  process.exitCode = 1;
} else {
  console.log(
    'Form control size check lulus (' + mixedFeatureFiles.length + ' file feature dengan pasangan Input/Select diaudit).',
  );
}
