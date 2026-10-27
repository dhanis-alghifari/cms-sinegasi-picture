import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ImagePreviewDialog } from '../src/shared/ui/ImagePreviewDialog';
import { imageService } from '../src/shared/api/image.service';
import type { PrivateImageResult } from '../src/shared/api/privateImageResponse';
import '../src/app/styles/index.css';

const result = document.getElementById('result')!;
const root = createRoot(document.getElementById('root')!);
const requests: Array<{ resolve: (value: PrivateImageResult) => void; reject: (error: Error) => void }> = [];
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII='), (char) => char.charCodeAt(0));
const image = { kind: 'blob' as const, blob: new Blob([png], { type: 'image/png' }) };
localStorage.setItem('sinegasi_token', 'synthetic-test-token');
imageService.getAuthenticatedImage = () => new Promise((resolve, reject) => { requests.push({ resolve, reject }); });

function render(open: boolean) {
  flushSync(() => root.render(<ImagePreviewDialog open={open} onOpenChange={() => undefined} src="/api/students/test-student/photo" alt="Foto uji" title="Foto profil siswa" />));
}
async function waitFor(check: () => boolean, message: string) {
  const deadline = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function testPreview() {
  render(true);
  await waitFor(() => requests.length === 1, 'request awal tidak dimulai');
  assert(document.querySelector('[data-slot="skeleton"]'), 'skeleton tidak tampil');
  requests[0].resolve(image);
  await waitFor(() => Boolean(document.querySelector('img[alt="Foto uji"]:not(.opacity-0)')), 'foto pertama tidak tampil');
  render(false);
  render(true);
  await waitFor(() => requests.length === 2, 'request saat buka kembali tidak dimulai');
  assert(document.querySelector('[data-slot="skeleton"]'), 'skeleton tidak tampil saat buka kembali');
  assert(!document.querySelector('img[alt="Foto uji"]'), 'alamat foto lama digunakan kembali');
  requests[1].reject(new Error('simulasi koneksi gagal'));
  await waitFor(() => Boolean([...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Coba lagi'))), 'tombol coba lagi tidak tampil');
  [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Coba lagi'))!.click();
  await waitFor(() => requests.length === 3, 'coba lagi tidak memulai request');
  requests[2].resolve({ kind: 'blob', blob: new Blob(['invalid image'], { type: 'image/png' }) });
  await waitFor(() => Boolean([...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Coba lagi'))), 'kerusakan gambar tidak ditangani');
  assert(!document.querySelector('img[alt="Foto uji"]'), 'gambar rusak masih terlihat');
  [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Coba lagi'))!.click();
  await waitFor(() => requests.length === 4, 'coba lagi setelah decode gagal tidak dimulai');
  requests[3].resolve(image);
  await waitFor(() => Boolean(document.querySelector('img[alt="Foto uji"]:not(.opacity-0)')), 'foto tidak pulih setelah coba lagi');
  assert(document.documentElement.scrollWidth === document.documentElement.clientWidth, 'layar memiliki overflow horizontal');
  result.textContent = `PASS width=${window.innerWidth} overflow=${document.documentElement.scrollWidth - document.documentElement.clientWidth}`;
  if (window.parent !== window) window.parent.postMessage(result.textContent, window.location.origin);
}

void testPreview().catch((error: unknown) => {
  result.textContent = `FAIL: ${error instanceof Error ? error.message : String(error)}`;
  if (window.parent !== window) window.parent.postMessage(result.textContent, window.location.origin);
});
