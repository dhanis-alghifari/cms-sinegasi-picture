# Billing worker module

Billing tidak memiliki route publik. `billing.service.ts` memvalidasi tanggal
dan hasil run, sedangkan `billing.repository.ts` hanya memanggil RPC atomic.
Scheduler di `workers/weeklyBillingWorker.ts` mengatur jadwal dan lifecycle;
locking, idempotency, dan insert finansial tetap dimiliki database function.
