import type { ClassAccount, ClassOption, ClassesMemoryState, ClassLevel } from './classes.types.js';
import { CLASS_LEVEL_VALUES } from './classes.types.js';

export const CLASS_LEVELS: ReadonlySet<string> = new Set(CLASS_LEVEL_VALUES);
export const CLASS_SELECT = 'id,nama_kelas,tingkat,is_active,created_at,created_by,updated_at,updated_by';
export const CLASS_PAGE_SIZE_MAX = 100;
export const CLASS_PAGE_MAX = 10_000;
export const CLASS_OPTIONS_LIMIT_MAX = 500;

const CLASS_GROUPS: ReadonlyArray<{ prefix: string; count: number }> = [
  { prefix: 'TKJ', count: 5 },
  { prefix: 'AK', count: 5 },
  { prefix: 'TB', count: 3 },
  { prefix: 'PH', count: 2 },
];

export function createDefaultClasses(): ClassAccount[] {
  const result: ClassAccount[] = [];
  const createdAt = new Date().toISOString();
  let index = 1;
  for (const level of CLASS_LEVEL_VALUES) {
    for (const group of CLASS_GROUPS) {
      for (let number = 1; number <= group.count; number += 1) {
        result.push({
          id: `cls-${index.toString().padStart(3, '0')}`,
          nama_kelas: `${level} ${group.prefix} ${number}`,
          tingkat: level,
          is_active: true,
          created_at: createdAt,
        });
        index += 1;
      }
    }
  }
  return result;
}

export function createClassesMemoryState(): ClassesMemoryState {
  return { classes: createDefaultClasses() };
}

export function parseClassPagination(pageValue?: number, pageSizeValue?: number) {
  const rawPage = Number.isFinite(pageValue) ? Math.floor(pageValue as number) : 1;
  const rawPageSize = Number.isFinite(pageSizeValue) ? Math.floor(pageSizeValue as number) : 20;
  const page = Math.min(CLASS_PAGE_MAX, Math.max(1, rawPage));
  const pageSize = Math.min(CLASS_PAGE_SIZE_MAX, Math.max(1, rawPageSize));
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

export function sanitizeClassSearch(value: string | undefined): string {
  return (value || '')
    .trim()
    .replace(/[%,_().\\*]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}

export function mapClassRow(row: Record<string, unknown>): ClassAccount {
  return {
    id: String(row.id),
    nama_kelas: String(row.nama_kelas),
    tingkat: String(row.tingkat),
    is_active: row.is_active !== false,
    ...(row.created_at == null ? {} : { created_at: String(row.created_at) }),
    ...(row.created_by == null ? {} : { created_by: String(row.created_by) }),
    ...(row.updated_at == null ? {} : { updated_at: String(row.updated_at) }),
    ...(row.updated_by == null ? {} : { updated_by: String(row.updated_by) }),
  };
}

export function mapMemoryClass(value: ClassAccount): ClassAccount {
  return { ...value };
}

export function mapClassOption(value: ClassAccount | Record<string, unknown>): ClassOption {
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id),
    nama_kelas: String(row.nama_kelas),
    tingkat: String(row.tingkat),
  };
}

export function isClassLevel(value: unknown): value is ClassLevel {
  return typeof value === 'string' && CLASS_LEVELS.has(value);
}

export function isMissingClassesSchemaError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null | undefined;
  return Boolean(candidate && (
    ['PGRST205', '42P01', '42703'].includes(candidate.code || '')
    || candidate.message?.toLowerCase().includes('classes')
  ));
}

export function safeClassErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as { code?: string } | null | undefined;
  if (candidate?.code === '23505') return 'Nama kelas tersebut sudah digunakan.';
  return fallback;
}

export type { ClassAccount, ClassOption, ClassLevel };
