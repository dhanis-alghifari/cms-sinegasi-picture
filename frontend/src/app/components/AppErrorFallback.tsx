import { isModuleLoadError } from './isModuleLoadError';

interface AppErrorFallbackProps {
  error: unknown;
}

export function AppErrorFallback({ error }: AppErrorFallbackProps) {
  const moduleLoadFailed = isModuleLoadError(error);

  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-canvas px-6 py-12 text-ink"
      role="alert"
    >
      <section className="w-full max-w-md rounded-xl border border-hairline bg-surface-1 p-6 text-center shadow-sm">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-semantic-danger/10 text-xl text-semantic-danger"
          aria-hidden="true"
        >
          !
        </div>
        <h1 className="text-lg font-semibold">
          {moduleLoadFailed ? 'Bagian aplikasi gagal dimuat' : 'Aplikasi mengalami gangguan'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-subtle">
          {moduleLoadFailed
            ? 'File halaman atau dialog tidak dapat dimuat. Periksa koneksi, lalu muat ulang untuk mengambil versi aplikasi terbaru.'
            : 'Halaman tidak dapat ditampilkan saat ini. Muat ulang halaman untuk mencoba lagi.'}
        </p>
        <p className="mt-2 text-sm leading-6 text-ink-subtle">
          Data yang belum disimpan dapat hilang saat halaman dimuat ulang.
        </p>
        {/* Reload only on user action: never discard a form or create a reload loop. */}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-12 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-focus focus-visible:ring-offset-2 md:h-9"
        >
          Muat ulang halaman
        </button>
      </section>
    </main>
  );
}
