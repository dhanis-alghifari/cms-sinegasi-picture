import fs from "node:fs";
import path from "node:path";
import { backgroundJobsEnabled } from '../workers/backgroundJobs.js';

export type RuntimeEnvironment = "development" | "test" | "production";

export interface RuntimeConfig {
  environment: RuntimeEnvironment;
  port: number;
  host: string;
  jwtSecret: string;
  corsOrigins: string[];
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  databaseUrl: string;
  trustProxy: boolean | number;
  publicDeployment: boolean;
  allowDevelopmentAuth: boolean;
  r2AccountId: string;
  r2BucketName: string;
  r2PublicDomain: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  ntfyEnabled: boolean;
  backgroundJobsEnabled: boolean;
  ntfyServerUrl: string;
  ntfyTopic: string;
  ntfyCashReviewTopic: string;
  ntfyAccessToken: string;
  ntfyFrontendUrl: string;
}

function loadEnvFile(): void {
  if (process.env.ENV_FILE_LOADING === 'disabled') return;
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "backend/.env"),
    path.resolve(__dirname, "../../.env"),
  ];
  const envPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!envPath) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseOrigins(
  value: string | undefined,
  environment: RuntimeEnvironment,
): string[] {
  const configured = (value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured.length > 0) {
    return configured.map((origin) => {
      if (origin === '*')
        throw new Error("CORS_ORIGINS tidak boleh menggunakan wildcard.");
      let parsed: URL;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error(`CORS origin tidak valid: ${origin}`);
      }
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash ||
        (environment === "production" && parsed.protocol !== "https:")
      ) {
        throw new Error(
          "CORS_ORIGINS harus berupa origin HTTP(S) tanpa path; production wajib HTTPS.",
        );
      }
      return parsed.origin;
    });
  }
  if (environment === "production") {
    throw new Error("CORS_ORIGINS wajib diatur pada production.");
  }
  return ["http://localhost:5173", "http://127.0.0.1:5173"];
}

loadEnvFile();

const environment = (process.env.NODE_ENV ||
  "development") as RuntimeEnvironment;
if (!["development", "test", "production"].includes(environment)) {
  throw new Error(`NODE_ENV tidak dikenal: ${environment}`);
}

const corsOrigins = parseOrigins(process.env.CORS_ORIGINS, environment);
const loopbackOriginHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
// An internet-facing development instance needs the same secret requirements
// as production. NODE_ENV alone is not a security boundary.
const publicDeployment = environment === "production"
  || parseBoolean(process.env.PUBLIC_DEPLOYMENT, false)
  || corsOrigins.some((origin) => origin.startsWith("https://")
    || !loopbackOriginHosts.has(new URL(origin).hostname));
if (publicDeployment && corsOrigins.some((origin) => {
  const parsed = new URL(origin);
  return parsed.protocol !== 'https:' && !loopbackOriginHosts.has(parsed.hostname);
})) {
  throw new Error('Frontend deployment publik wajib menggunakan origin HTTPS.');
}

function parseTrustProxy(value: string | undefined): boolean | number {
  if (!value || ["false", "0"].includes(value.trim().toLowerCase())) return false;
  if (/^[1-9][0-9]*$/.test(value.trim())) {
    const hops = Number(value);
    if (hops <= 4) return hops;
  }
  if (!publicDeployment && parseBoolean(value, false)) return true;
  throw new Error("TRUST_PROXY harus false atau jumlah hop proxy tepercaya (1–4), bukan true pada deployment publik. Pastikan API tidak dapat diakses melewati proxy tersebut.");
}

const defaultDevelopmentJwtSecret = "sinegasi-dev-secret-change-in-production";
const configuredJwtSecret = process.env.JWT_SECRET?.trim();
const jwtSecret = configuredJwtSecret || defaultDevelopmentJwtSecret;
if (
  publicDeployment &&
  (!configuredJwtSecret ||
    configuredJwtSecret === defaultDevelopmentJwtSecret ||
    configuredJwtSecret.length < 32)
) {
  throw new Error(
    "JWT_SECRET wajib diatur dengan nilai acak minimal 32 karakter pada deployment publik.",
  );
}

const supabaseUrl = (process.env.SUPABASE_URL || "")
  .replace(/[\r\n\t "']/g, "")
  .replace(/\/$/, "");
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (publicDeployment && (!supabaseUrl || !supabaseServiceRoleKey)) {
  throw new Error(
    "SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diatur pada deployment publik.",
  );
}

if (publicDeployment) {
  let parsedSupabaseUrl: URL;
  try { parsedSupabaseUrl = new URL(supabaseUrl); }
  catch { throw new Error('SUPABASE_URL tidak valid pada deployment publik.'); }
  if (parsedSupabaseUrl.protocol !== "https:" || parsedSupabaseUrl.username || parsedSupabaseUrl.password) {
    throw new Error("SUPABASE_URL wajib HTTPS tanpa kredensial URL pada deployment publik.");
  }
}

export const runtimeConfig: RuntimeConfig = {
  environment,
  port: Number.parseInt(process.env.PORT || "5001", 10) || 5001,
  host: process.env.HOST || "0.0.0.0",
  jwtSecret,
  corsOrigins,
  supabaseUrl,
  supabaseServiceRoleKey,
  databaseUrl: process.env.DATABASE_URL || "",
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  publicDeployment,
  // Mock credentials are useful locally, but must never be enabled implicitly
  // in production or accidentally become an authentication bypass.
  allowDevelopmentAuth:
    !publicDeployment &&
    parseBoolean(process.env.ALLOW_DEV_AUTH, false),
  r2AccountId:
    process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || "",
  r2BucketName:
    process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || "",
  r2PublicDomain: (
    process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN ||
    process.env.R2_PUBLIC_DOMAIN ||
    ""
  ).replace(/\/$/, ""),
  r2AccessKeyId:
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
    process.env.R2_ACCESS_KEY_ID ||
    "",
  r2SecretAccessKey:
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    process.env.R2_SECRET_ACCESS_KEY ||
    "",
  // Push delivery is opt-in so local/test runs never leak workflow metadata to
  // a shared topic unless the operator explicitly enables it.
  ntfyEnabled: parseBoolean(process.env.NTFY_ENABLED, false),
  backgroundJobsEnabled: backgroundJobsEnabled(process.env.BACKGROUND_JOBS_ENABLED, environment === 'production'),
  ntfyServerUrl: (process.env.NTFY_SERVER_URL || "https://ntfy.sh").replace(/\/$/, ""),
  ntfyTopic: (process.env.NTFY_TOPIC || "sinegasi-dev-notif").trim(),
  ntfyCashReviewTopic: (process.env.NTFY_CASH_REVIEW_TOPIC || "").trim(),
  ntfyAccessToken: (process.env.NTFY_ACCESS_TOKEN || "").trim(),
  ntfyFrontendUrl: (process.env.NTFY_FRONTEND_URL || "https://sinegasi-picture-develop-cms.pages.dev").replace(/\/$/, ""),
};
