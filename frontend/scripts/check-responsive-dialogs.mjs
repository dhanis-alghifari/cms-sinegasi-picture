import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'src');
const dialogPrimitivePath = path.join(sourceRoot, 'shared', 'ui', 'primitives', 'dialog.tsx');
const contestEntriesDialogPath = path.join(sourceRoot, 'features', 'contests', 'components', 'ContestEntriesDialog.tsx');
const violations = [];
let dialogFilesChecked = 0;

async function collectTsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return collectTsxFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [entryPath] : [];
  }));

  return nestedFiles.flat();
}

function relativePath(filePath) {
  return path.relative(projectRoot, filePath);
}

const files = await collectTsxFiles(sourceRoot);

for (const filePath of files) {
  const source = await readFile(filePath, 'utf8');
  if (!source.includes('<DialogContent')) continue;
  dialogFilesChecked += 1;

  if (!source.includes('<DialogFooter')) {
    violations.push(`${relativePath(filePath)}: DialogContent tidak memiliki DialogFooter.`);
  }

  for (const match of source.matchAll(/<DialogFooter\b[^>]*>/g)) {
    if (/\b(?:-mb-|absolute|fixed|translate-y-)/.test(match[0])) {
      violations.push(`${relativePath(filePath)}: DialogFooter memakai offset/position yang dapat memotong tombol.`);
    }
  }

  if (/<DialogContent\b[^>]*\bp-0\b/.test(source)) {
    const footers = [...source.matchAll(/<DialogFooter\b[^>]*>/g)].map((match) => match[0]);
    if (footers.some((footer) => !/\bmd:pb-/.test(footer))) {
      violations.push(`${relativePath(filePath)}: DialogContent p-0 wajib memberi padding bawah desktop (md:pb-*) pada DialogFooter.`);
    }
  }

  if (/<DialogContent\b[^>]*overflow-hidden/.test(source)) {
    const usesThreeRowGrid = /<DialogContent\b[^>]*\bgrid\b[^>]*grid-rows-\[auto_minmax\(0,1fr\)_auto\]/.test(source);
    const formClasses = [...source.matchAll(/<form\b[^>]*className="([^"]*)"/g)].map((match) => match[1]);
    const hasConstrainedForm = formClasses.some((className) =>
      ['min-h-0', 'flex-1', 'overflow-hidden'].every((token) => className.split(/\s+/).includes(token)),
    );
    const classNames = [...source.matchAll(/className="([^"]*)"/g)].map((match) => match[1]);
    const hasScrollableBody = classNames.some((className) => {
      const tokens = className.split(/\s+/);
      return ['min-h-0', 'overflow-y-auto'].every((token) => tokens.includes(token))
        && (tokens.includes('flex-1') || usesThreeRowGrid);
    });

    if (!hasScrollableBody || (formClasses.length > 0 && !hasConstrainedForm)) {
      violations.push(`${relativePath(filePath)}: dialog overflow-hidden wajib memiliki satu body scroll dengan constraint flex atau grid; form pembungkus juga wajib memiliki constraint layout.`);
    }
  }
}

const dialogPrimitive = await readFile(dialogPrimitivePath, 'utf8');
const contestEntriesDialog = await readFile(contestEntriesDialogPath, 'utf8');
const requiredFooterContracts = [
  '!mt-0',
  'flex-none',
  'shrink-0',
  '[&>[data-slot=button]]:min-h-12',
  '[&>[data-slot=button]]:w-full',
  'pb-[env(safe-area-inset-bottom)]',
  'flex-col',
  'md:flex-row',
  'md:[&>[data-slot=button]]:min-h-9',
  'md:[&>[data-slot=button]]:w-auto',
];

for (const contract of requiredFooterContracts) {
  if (!dialogPrimitive.includes(contract)) {
    violations.push(`src/shared/ui/primitives/dialog.tsx: kontrak footer hilang (${contract}).`);
  }
}

const contestDialogContentTag = contestEntriesDialog.match(/<DialogContent\b[^>]*>/)?.[0] ?? '';
const contestDialogContentContracts = [
  'grid',
  'h-[min(90dvh,48rem)]',
  'max-h-[90dvh]',
  'overflow-hidden',
  'overflow-y-hidden',
  'grid-rows-[auto_minmax(0,1fr)_auto]',
  'gap-0',
];

for (const contract of contestDialogContentContracts) {
  if (!contestDialogContentTag.includes(contract)) {
    violations.push(`src/features/contests/components/ContestEntriesDialog.tsx: DialogContent wajib menjadi grid tiga baris (${contract}).`);
  }
}

const contestDialogContracts = [
  'min-h-0 min-w-0 space-y-4 overflow-y-auto overscroll-contain',
  'min-h-0 border-t border-hairline',
];

for (const contract of contestDialogContracts) {
  if (!contestEntriesDialog.includes(contract)) {
    violations.push(`src/features/contests/components/ContestEntriesDialog.tsx: kontrak layout upload dialog hilang (${contract}).`);
  }
}

if (/data-slot="dialog-footer"[\s\S]{0,500}\b-mb-/.test(dialogPrimitive)) {
  violations.push('src/shared/ui/primitives/dialog.tsx: DialogFooter tidak boleh memakai margin bawah negatif.');
}

if (/data-slot="dialog-footer"[\s\S]{0,500}\bmt-auto\b/.test(dialogPrimitive)) {
  violations.push('src/shared/ui/primitives/dialog.tsx: DialogFooter tidak boleh memakai mt-auto yang dapat menyerap tinggi dialog.');
}

if (/data-slot="dialog-footer"[\s\S]{0,500}\bsm:(?:flex-row|\[&>\[data-slot=button\]\])/.test(dialogPrimitive)) {
  violations.push('src/shared/ui/primitives/dialog.tsx: layout desktop DialogFooter harus mulai pada md, bukan sm.');
}

if (violations.length > 0) {
  console.error('Responsive dialog check gagal:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`Responsive dialog check lulus (${dialogFilesChecked} dialog diperiksa).`);
}
