import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'src');
const dialogPrimitivePath = path.join(sourceRoot, 'components', 'ui', 'dialog.tsx');
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

  if (/<DialogContent\b[^>]*overflow-hidden/.test(source)) {
    const formClasses = [...source.matchAll(/<form\b[^>]*className="([^"]*)"/g)].map((match) => match[1]);
    const hasConstrainedForm = formClasses.some((className) =>
      ['min-h-0', 'flex-1', 'overflow-hidden'].every((token) => className.split(/\s+/).includes(token)),
    );
    const hasScrollableBody = /className="[^"]*overflow-y-auto[^"]*"/.test(source);

    if (!hasConstrainedForm || !hasScrollableBody) {
      violations.push(`${relativePath(filePath)}: dialog overflow-hidden wajib memiliki form min-h-0 dan satu body overflow-y-auto.`);
    }
  }
}

const dialogPrimitive = await readFile(dialogPrimitivePath, 'utf8');
const requiredFooterContracts = [
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
    violations.push(`src/components/ui/dialog.tsx: kontrak footer hilang (${contract}).`);
  }
}

if (/data-slot="dialog-footer"[\s\S]{0,500}\b-mb-/.test(dialogPrimitive)) {
  violations.push('src/components/ui/dialog.tsx: DialogFooter tidak boleh memakai margin bawah negatif.');
}

if (/data-slot="dialog-footer"[\s\S]{0,500}\bsm:(?:flex-row|\[&>\[data-slot=button\]\])/.test(dialogPrimitive)) {
  violations.push('src/components/ui/dialog.tsx: layout desktop DialogFooter harus mulai pada md, bukan sm.');
}

if (violations.length > 0) {
  console.error('Responsive dialog check gagal:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`Responsive dialog check lulus (${dialogFilesChecked} dialog diperiksa).`);
}
