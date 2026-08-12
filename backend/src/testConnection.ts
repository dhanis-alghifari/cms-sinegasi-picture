import { runtimeConfig } from './config/env.js';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function testConnections() {
  console.log('\n============== 🔍 MENGETES KONEKSI BACKEND ==============\n');

  // 1. Check Supabase REST API Connection
  const supabaseUrl = runtimeConfig.supabaseUrl;
  const supabaseKey = runtimeConfig.supabaseServiceRoleKey;

  if (supabaseUrl && supabaseKey) {
    console.log(`📡 Testing Supabase REST API (${supabaseUrl}/rest/v1/)...`);
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      });
      if (res.ok || res.status === 200) {
        console.log(`✅ Supabase REST API Response: Status ${res.status} ${res.statusText} (OK!)`);
      } else {
        console.log(`⚠️ Supabase REST API Response: Status ${res.status} ${res.statusText}`);
      }
    } catch (err: unknown) {
      console.error(`❌ Gagal terhubung ke Supabase REST API: ${errorMessage(err)}`);
    }
  } else {
    console.log('⚠️ SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi lengkap.');
  }

  console.log('\n---------------------------------------------------------');

  // 1b. Check DATABASE_URL (PostgreSQL Connection String Host)
  const dbUrl = runtimeConfig.databaseUrl;
  if (dbUrl) {
    try {
      const match = dbUrl.match(/@([^:\/]+)(?::(\d+))?/);
      if (match) {
        const host = match[1];
        const port = parseInt(match[2] || '5432', 10);
        console.log(`🐘 Testing PostgreSQL Database Host (${host}:${port})...`);
        const dns = await import('dns/promises');
        try {
          const addresses = await dns.lookup(host);
          console.log(`✅ Host DB terdeteksi (IP: ${addresses.address})`);
        } catch (dnsErr: unknown) {
          console.error(`⚠️ Host DB (${host}) tidak ditemukan di DNS (${errorMessage(dnsErr)}).`);
          console.log(`💡 Tip: Di Supabase Dashboard -> Project Settings -> Database -> Connection String -> URI, salin URL Connection String terbaru (misal: Supabase Connection Pooler).`);
        }
      }
    } catch (dbErr: unknown) {
      console.error(`⚠️ Format DATABASE_URL tidak valid: ${errorMessage(dbErr)}`);
    }
  }

  console.log('\n---------------------------------------------------------');

  // 2. Check Cloudflare R2 Connection
  const r2AccountId = runtimeConfig.r2AccountId.replace(/["']/g, '');
  const r2BucketName = runtimeConfig.r2BucketName.replace(/["']/g, '');
  const r2AccessKey = runtimeConfig.r2AccessKeyId.replace(/["']/g, '');

  if (r2AccountId && r2BucketName) {
    const r2Endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com/${r2BucketName}`;
    console.log(`☁️ Testing Cloudflare R2 Storage Endpoint (${r2Endpoint})...`);
    try {
      const res = await fetch(r2Endpoint);
      if (res.status === 403 || res.status === 400 || res.status === 200) {
        console.log(`✅ Cloudflare R2 Endpoint SUCCESS! Host terjangkau (Status HTTP: ${res.status} - Normal, S3 Auth Required)`);
        if (r2AccessKey) {
          console.log(`🔑 R2 Access Key ID terdeteksi: ${r2AccessKey.substring(0, 8)}...`);
        }
      } else {
        console.log(`⚠️ Cloudflare R2 Endpoint Responded with Status: ${res.status}`);
      }
    } catch (err: unknown) {
      console.error(`❌ Gagal terhubung ke Cloudflare R2: ${errorMessage(err)}`);
    }
  } else {
    console.log('⚠️ R2_ACCOUNT_ID atau R2_BUCKET_NAME belum diisi.');
  }

  console.log('\n---------------------------------------------------------');

  // 3. Check Fastify Server Health (if running)
  const port = String(runtimeConfig.port);
  console.log(`🚀 Testing Local Fastify Server (http://localhost:${port}/api/health)...`);
  try {
    const res = await fetch(`http://localhost:${port}/api/health`);
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ Fastify Backend Status: SERVING OK! Response:`, data);
    } else {
      console.log(`ℹ️ Fastify server merespons (Status: ${res.status}). Jalankan 'npm run dev' di folder backend jika server belum dinyalakan.`);
    }
  } catch (_err) {
    console.log(`ℹ️ Server Fastify belum dinyalakan. Jalankan 'npm run dev' di folder backend.`);
  }

  console.log('\n=========================================================\n');
}

testConnections();
