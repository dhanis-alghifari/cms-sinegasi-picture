import type { ClientConfig } from 'pg';

/** No dotenv/runtimeConfig import: administrative tools never select a DB implicitly. */
export function buildMigrationConnectionConfig(
  databaseUrl: string,
  projectRef: string,
  allowLocal = false,
): ClientConfig {
  if (!/^[a-z]{20}$/.test(projectRef)) throw new Error('Project reference tidak valid.');
  let url: URL;
  try { url = new URL(databaseUrl); }
  catch { throw new Error('URL database administratif tidak valid.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash) {
    throw new Error('Gunakan URL PostgreSQL tanpa fragment.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (allowLocal !== local) throw new Error('Mode local dan endpoint database tidak cocok.');
  if (!local) {
    const direct = url.hostname === `db.${projectRef}.supabase.co`;
    const sessionPooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)
      && decodeURIComponent(url.username).endsWith(`.${projectRef}`);
    if ((!direct && !sessionPooler) || (url.port && url.port !== '5432') || url.pathname !== '/postgres') {
      throw new Error('Target harus project yang dikonfirmasi, direct/session pooler port 5432; bukan transaction pooler.');
    }
  }
  // pg-connection-string can overwrite the explicit ssl object. Remove only
  // approved SSL hints; never permit sslmode=no-verify/disable or key parameters.
  for (const [key, value] of url.searchParams) {
    if (key !== 'sslmode' || !['require', 'verify-full'].includes(value)) {
      throw new Error('Parameter URL database tidak diizinkan.');
    }
  }
  url.search = '';
  return {
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
    application_name: 'sinegasi-reviewed-migrations',
  };
}

export function assertLegacyMigrationTarget(databaseUrl: string, production: boolean): void {
  let target: URL;
  try { target = new URL(databaseUrl); }
  catch { throw new Error('URL legacy database tidak valid.'); }
  const ref = 'pvbdiftvzoeelibxlxzb';
  if (production || target.hostname.toLowerCase() === `db.${ref}.supabase.co`
    || decodeURIComponent(target.username).toLowerCase().endsWith(`.${ref}`)) {
    throw new Error('Legacy migration runner dilarang pada production; gunakan manifest dan runner production yang direview.');
  }
}

/** Split ONLY top-level SQL statements; function bodies/comments retain their bytes. */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quote: "'" | '"' | null = null;
  let escapeString = false;
  let dollar: string | null = null;
  let blockDepth = 0;
  let lineComment = false;
  for (let i = 0; i < sql.length; i += 1) {
    const current = sql[i];
    const next = sql[i + 1];
    if (lineComment) { if (current === '\n') lineComment = false; continue; }
    if (blockDepth) {
      if (current === '/' && next === '*') { blockDepth += 1; i += 1; }
      else if (current === '*' && next === '/') { blockDepth -= 1; i += 1; }
      continue;
    }
    if (dollar) {
      if (sql.startsWith(dollar, i)) { i += dollar.length - 1; dollar = null; }
      continue;
    }
    if (quote) {
      if (current === quote && next === quote) { i += 1; continue; }
      if (quote === "'" && escapeString && current === '\\') { i += 1; continue; }
      if (current === quote) quote = null;
      continue;
    }
    if (current === '-' && next === '-') { lineComment = true; i += 1; continue; }
    if (current === '/' && next === '*') { blockDepth = 1; i += 1; continue; }
    if (current === "'" || current === '"') {
      quote = current;
      escapeString = current === "'" && /[eE]/.test(sql[i - 1] ?? '') && !/[A-Za-z_0-9]/.test(sql[i - 2] ?? '');
      continue;
    }
    if (current === '$') {
      const match = /^(\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)/.exec(sql.slice(i));
      if (match) { dollar = match[0]; i += dollar.length - 1; continue; }
    }
    if (current === ';') { statements.push(sql.slice(start, i)); start = i + 1; }
  }
  if (quote || dollar || blockDepth) throw new Error('SQL memiliki literal/comment yang belum ditutup.');
  statements.push(sql.slice(start));
  return statements.filter((statement) => stripLeadingComments(statement).trim() !== '');
}

function stripLeadingComments(sql: string): string {
  let value = sql.trimStart();
  while (value.startsWith('--') || value.startsWith('/*')) {
    if (value.startsWith('--')) {
      const end = value.indexOf('\n');
      value = end < 0 ? '' : value.slice(end + 1).trimStart();
    } else {
      let depth = 1;
      let i = 2;
      while (i < value.length && depth) {
        if (value.slice(i, i + 2) === '/*') { depth += 1; i += 2; }
        else if (value.slice(i, i + 2) === '*/') { depth -= 1; i += 2; }
        else i += 1;
      }
      value = value.slice(i).trimStart();
    }
  }
  return value;
}

/** Runner owns one transaction PER FILE, including the history INSERT. */
export function transactionalSql(sql: string): string {
  const statements = splitSqlStatements(sql);
  const first = stripLeadingComments(statements[0] ?? '').trim();
  const last = stripLeadingComments(statements.at(-1) ?? '').trim();
  if (/^(BEGIN|START TRANSACTION)$/i.test(first) && /^COMMIT$/i.test(last)) {
    statements.shift();
    statements.pop();
  }
  for (const statement of statements) {
    const head = stripLeadingComments(statement);
    if (/^(BEGIN|START TRANSACTION|COMMIT|ROLLBACK|ABORT|PREPARE TRANSACTION|SAVEPOINT|RELEASE|END)\b/i.test(head)
      || /^(VACUUM|ALTER SYSTEM|CREATE DATABASE|DROP DATABASE|CREATE TABLESPACE|DROP TABLESPACE)\b/i.test(head)
      || /^(CREATE|DROP|REINDEX)\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i.test(head)
      || /^COPY\b[\s\S]*\bFROM\s+STDIN\b/i.test(head)) {
      throw new Error('SQL memerlukan transaction boundary khusus; review manual diperlukan.');
    }
  }
  if (!statements.length) throw new Error('Migration SQL kosong.');
  return `${statements.join(';\n')};`;
}
