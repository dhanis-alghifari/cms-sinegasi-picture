import fs from 'node:fs';
import path from 'node:path';

export type RuntimeEnvironment = 'development' | 'test' | 'production';

export interface RuntimeConfig {
  environment: RuntimeEnvironment;
  port: number;
  host: string;
  jwtSecret: string;
  corsOrigins: string[];
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  databaseUrl: string;
  trustProxy: boolean;
  allowDevelopmentAuth: boolean;
  studentDefaultPassword: string;
  r2AccountId: string;
  r2BucketName: string;
  r2PublicDomain: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
}

function loadEnvFile(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend/.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  const envPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!envPath) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseOrigins(value: string | undefined, environment: RuntimeEnvironment): string[] {
  const configured = (value || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  if (configured.length > 0) {
    return configured.map((origin) => {
      if (origin === '*') throw new Error('CORS_ORIGINS tidak boleh menggunakan wildcard.');
      let parsed: URL;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error(`CORS origin tidak valid: ${origin}`);
      }
      if (!['http:', 'https:'].includes(parsed.protocol)
        || parsed.username
        || parsed.password
        || parsed.pathname !== '/'
        || parsed.search
        || parsed.hash
        || (environment === 'production' && parsed.protocol !== 'https:')) {
        throw new Error('CORS_ORIGINS harus berupa origin HTTP(S) tanpa path; production wajib HTTPS.');
      }
      return parsed.origin;
    });
  }
  if (environment === 'production') {
    throw new Error('CORS_ORIGINS wajib diatur pada production.');
  }
  return ['http://localhost:5173', 'http://127.0.0.1:5173'];
}

loadEnvFile();

const environment = (process.env.NODE_ENV || 'development') as RuntimeEnvironment;
if (!['development', 'test', 'production'].includes(environment)) {
  throw new Error(`NODE_ENV tidak dikenal: ${environment}`);
}

const defaultDevelopmentJwtSecret = 'sinegasi-dev-secret-change-in-production';
const configuredJwtSecret = process.env.JWT_SECRET?.trim();
const jwtSecret = configuredJwtSecret || defaultDevelopmentJwtSecret;
if (environment === 'production' && (!configuredJwtSecret || configuredJwtSecret === defaultDevelopmentJwtSecret || configuredJwtSecret.length < 32)) {
  throw new Error('JWT_SECRET wajib diatur dengan nilai acak minimal 32 karakter pada production.');
}

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/[\r\n\t "']/g, '').replace(/\/$/, '');
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (environment === 'production' && (!supabaseUrl || !supabaseServiceRoleKey)) {
  throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diatur pada production.');
}

const defaultStudentPassword = 'siswa123';
const studentDefaultPassword = process.env.STUDENT_DEFAULT_PASSWORD || defaultStudentPassword;
if (environment === 'production' && studentDefaultPassword === defaultStudentPassword) {
  throw new Error('STUDENT_DEFAULT_PASSWORD wajib diganti pada production.');
}

export const runtimeConfig: RuntimeConfig = {
  environment,
  port: Number.parseInt(process.env.PORT || '5001', 10) || 5001,
  host: process.env.HOST || '0.0.0.0',
  jwtSecret,
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS, environment),
  supabaseUrl,
  supabaseServiceRoleKey,
  databaseUrl: process.env.DATABASE_URL || '',
  trustProxy: parseBoolean(process.env.TRUST_PROXY, false),
  // Mock credentials are useful locally, but must never be enabled implicitly
  // in production or accidentally become an authentication bypass.
  allowDevelopmentAuth: environment !== 'production' && parseBoolean(process.env.ALLOW_DEV_AUTH, false),
  studentDefaultPassword,
  r2AccountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '',
  r2BucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || '',
  r2PublicDomain: (process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || process.env.R2_PUBLIC_DOMAIN || '').replace(/\/$/, ''),
  r2AccessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '',
  r2SecretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '',
};
