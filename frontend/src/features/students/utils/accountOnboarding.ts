export function normalizeWhatsAppNumber(value: string): string | null {
  const compact = value.trim().replace(/[\s()-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;

  const digits = compact.startsWith('+') ? compact.slice(1) : compact;
  const international = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  return /^628[1-9]\d{7,10}$/.test(international) ? `+${international}` : null;
}

export function createOperationKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function buildStudentCredentialsMessage(input: {
  studentName?: string;
  username: string;
  temporaryPassword: string;
}): string {
  const loginUrl = new URL('/login', window.location.origin).toString();
  const greeting = input.studentName ? `Halo ${input.studentName},` : 'Halo,';

  return [
    greeting,
    '',
    'Ini akun kamu untuk aplikasi Sinegasi Picture.',
    `Link login: ${loginUrl}`,
    `Username: ${input.username}`,
    `Password sementara: ${input.temporaryPassword}`,
    '',
    'Segera login dan ganti password melalui menu Ganti Password. Jangan bagikan kredensial ini kepada orang lain. Jika akun diduga disalahgunakan, segera hubungi Guru Pembina.',
  ].join('\n');
}

export function buildWhatsAppChatUrl(phoneNumber: string): string | null {
  const normalized = normalizeWhatsAppNumber(phoneNumber);
  if (!normalized) return null;
  return `https://wa.me/${normalized.replace(/\D/g, '')}`;
}
