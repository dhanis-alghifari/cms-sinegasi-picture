import { useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { getErrorMessage } from '@/shared/api/errors';
import { useCreateSocialAccountMutation, useUpdateSocialAccountMutation } from '../hooks/useSocialMediaQueries';
import type { SocialAccount, SocialPlatform } from '../types/socialMedia.types';
import { isAllowedPlatformUrl, SOCIAL_PLATFORM_LABELS } from '../utils/publicationRules';

const PLATFORMS: readonly SocialPlatform[] = ['instagram', 'tiktok', 'youtube', 'whatsapp'];

interface AccountDraft {
  platform: SocialPlatform;
  account_name: string;
  account_url: string;
}

function initialDraft(): AccountDraft {
  return { platform: 'instagram', account_name: '', account_url: '' };
}

function AccountRow({ account }: { account: SocialAccount }) {
  const updateAccount = useUpdateSocialAccountMutation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.account_name);
  const [url, setUrl] = useState(account.account_url);
  const [isActive, setIsActive] = useState(account.is_active);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim() || !isAllowedPlatformUrl(account.platform, url.trim())) {
      setError('Nama akun wajib diisi dan tautan harus HTTPS dari platform yang sesuai.');
      return;
    }
    if (reason.trim().length < 5) {
      setError('Alasan perubahan minimal 5 karakter.');
      return;
    }
    try {
      await updateAccount.mutateAsync({
        id: account.id,
        input: { account_name: name.trim(), account_url: url.trim(), is_active: isActive, expected_version: account.version, change_reason: reason.trim() },
        idempotencyKey: crypto.randomUUID(),
      });
      setEditing(false);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  };

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-3">
      {editing ? (
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-ink-subtle"><span>Nama akun</span><Input value={name} onChange={(event) => setName(event.target.value)} className="min-h-11" /></label>
            <label className="space-y-1 text-xs text-ink-subtle"><span>URL profil resmi</span><Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} className="min-h-11" /></label>
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-hairline px-3 text-sm text-ink-subtle"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-primary" /> Akun dapat dipilih untuk pencatatan baru</label>
          <label className="block space-y-1 text-xs text-ink-subtle"><span>Alasan perubahan</span><Input value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} className="min-h-11" placeholder="Contoh: URL akun berubah" /></label>
          {error && <p role="alert" className="text-xs text-semantic-danger">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={updateAccount.isPending} className="min-h-11"><Check size={16} aria-hidden="true" /> Simpan</Button>
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => { setEditing(false); setName(account.account_name); setUrl(account.account_url); setIsActive(account.is_active); setReason(''); setError(''); }}><X size={16} aria-hidden="true" /> Batal</Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{account.account_name} <span className="font-normal text-ink-tertiary">· {SOCIAL_PLATFORM_LABELS[account.platform]}</span></p>
            <a href={account.account_url} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary underline underline-offset-2">{account.account_url}</a>
            <p className="mt-1 text-xs text-ink-subtle">{account.is_active ? 'Akun aktif' : 'Akun diarsipkan'}</p>
          </div>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing(true)} aria-label={`Ubah akun ${account.account_name}`}><Pencil size={15} aria-hidden="true" /> Ubah</Button>
        </div>
      )}
    </div>
  );
}

export function SocialAccountManager({ accounts }: { accounts: SocialAccount[] }) {
  const createAccount = useCreateSocialAccountMutation();
  const [draft, setDraft] = useState<AccountDraft>(initialDraft);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!draft.account_name.trim()) { setError('Nama akun wajib diisi.'); return; }
    if (!isAllowedPlatformUrl(draft.platform, draft.account_url.trim())) { setError('Gunakan tautan HTTPS dari platform yang dipilih.'); return; }
    try {
      await createAccount.mutateAsync({ input: { ...draft, account_name: draft.account_name.trim(), account_url: draft.account_url.trim() }, idempotencyKey: crypto.randomUUID() });
      setDraft(initialDraft());
    } catch (submitError) { setError(getErrorMessage(submitError)); }
  };

  return (
    <section className="space-y-4 rounded-xl border border-hairline bg-surface-2/50 p-4" aria-labelledby="social-accounts-heading">
      <div>
        <h3 id="social-accounts-heading" className="text-base font-semibold text-ink">Akun resmi Sinegasi Picture</h3>
        <p className="mt-1 text-xs text-ink-subtle">Daftar ini dikelola Guru Pembina. Tim Humas hanya memilih akun yang sudah disiapkan.</p>
      </div>
      <form onSubmit={submit} className="grid gap-3 rounded-lg border border-hairline bg-surface-1 p-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
        <div className="space-y-1"><Label htmlFor="social-account-platform">Platform</Label><Select value={draft.platform} onValueChange={(value) => { if (value && PLATFORMS.includes(value as SocialPlatform)) setDraft((current) => ({ ...current, platform: value as SocialPlatform })); }}><SelectTrigger id="social-account-platform" className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map((platform) => <SelectItem key={platform} value={platform}>{SOCIAL_PLATFORM_LABELS[platform]}</SelectItem>)}</SelectContent></Select></div>
        <label className="space-y-1 text-xs text-ink-subtle"><span>Nama akun</span><Input value={draft.account_name} onChange={(event) => setDraft((current) => ({ ...current, account_name: event.target.value }))} className="min-h-11" placeholder="@sinegasipicture" /></label>
        <label className="space-y-1 text-xs text-ink-subtle"><span>URL profil resmi</span><Input type="url" value={draft.account_url} onChange={(event) => setDraft((current) => ({ ...current, account_url: event.target.value }))} className="min-h-11" placeholder="https://instagram.com/..." /></label>
        <Button type="submit" disabled={createAccount.isPending} className="min-h-11"><Plus size={16} aria-hidden="true" /> Tambah</Button>
        {error && <p role="alert" className="text-xs text-semantic-danger sm:col-span-full">{error}</p>}
      </form>
      <div className="space-y-2">
        {accounts.length === 0 ? <p className="rounded-lg border border-dashed border-hairline p-4 text-center text-sm text-ink-subtle">Belum ada akun media sosial resmi.</p> : accounts.map((account) => <AccountRow key={account.id} account={account} />)}
      </div>
    </section>
  );
}
