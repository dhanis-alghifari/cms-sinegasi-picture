import { useState, type FormEvent } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { EvidenceFileField } from './EvidenceFileField';
import type { AgendaActivity } from '@/features/agenda/types/agenda.types';
import type { CreatePublicationInput, PublicationType, SocialAccount, SocialPlatform } from '../types/socialMedia.types';
import { CONTENT_TYPES_BY_PLATFORM, SOCIAL_CONTENT_LABELS, SOCIAL_PLATFORM_LABELS, getPublicationValidationError, isStoryPublication } from '../utils/publicationRules';

function jakartaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function getPlatformUrlLabel(requiresPhoto: boolean, platform: SocialPlatform): string {
  if (requiresPhoto) return '';
  if (platform === 'whatsapp') return ' (opsional jika ada foto bukti)';
  return ' *';
}

interface SocialPublicationFormProps {
  accounts: SocialAccount[];
  activities: AgendaActivity[];
  isSaving: boolean;
  onSubmit: (input: CreatePublicationInput, evidence: File | null) => Promise<void>;
}

export function SocialPublicationForm({ accounts, activities, isSaving, onSubmit }: SocialPublicationFormProps) {
  const activeAccounts = accounts.filter((account) => account.is_active);
  const [accountId, setAccountId] = useState(activeAccounts[0]?.id ?? '');
  const [contentType, setContentType] = useState<PublicationType>('feed');
  const [caption, setCaption] = useState('');
  const [publishedAt, setPublishedAt] = useState(jakartaToday());
  const [platformUrl, setPlatformUrl] = useState('');
  const [agendaActivityId, setAgendaActivityId] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [error, setError] = useState('');

  const selectedAccount = activeAccounts.find((account) => account.id === accountId) ?? activeAccounts[0];
  const platform: SocialPlatform = selectedAccount?.platform ?? 'instagram';
  const availableContentTypes = CONTENT_TYPES_BY_PLATFORM[platform];
  const effectiveContentType = availableContentTypes.includes(contentType) ? contentType : availableContentTypes[0];
  const requiresPhoto = isStoryPublication(platform, effectiveContentType);
  const selectedAccountChanged = selectedAccount?.id !== accountId;

  const accountOptions = activeAccounts.map((account) => ({
    id: account.id,
    label: `${SOCIAL_PLATFORM_LABELS[account.platform]} · ${account.account_name}`,
  }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!selectedAccount) { setError('Guru Pembina perlu menambahkan akun resmi sebelum publikasi dapat dicatat.'); return; }
    if (selectedAccountChanged) { setAccountId(selectedAccount.id); }
    if (caption.trim().length < 3) { setError('Uraian konten minimal 3 karakter.'); return; }
    if (!publishedAt || publishedAt > jakartaToday()) { setError('Tanggal publikasi wajib diisi dan tidak boleh di masa depan.'); return; }
    const ruleError = getPublicationValidationError({ platform, contentType: effectiveContentType, platformUrl, evidenceCount: evidence ? 1 : 0 });
    if (ruleError) { setError(ruleError); return; }
    try {
      await onSubmit({
        social_account_id: selectedAccount.id,
        content_type: effectiveContentType,
        caption: caption.trim(),
        published_at: publishedAt,
        ...(platformUrl.trim() ? { platform_url: platformUrl.trim() } : {}),
        ...(agendaActivityId ? { agenda_activity_id: agendaActivityId } : {}),
        status: requiresPhoto || evidence ? 'draft' : 'recorded',
      }, evidence);
      setCaption('');
      setPlatformUrl('');
      setAgendaActivityId('');
      setEvidence(null);
      setPublishedAt(jakartaToday());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Publikasi belum berhasil disimpan. Coba lagi.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-hairline bg-surface-1 p-4" aria-label="Form catat publikasi media sosial">
      <div>
        <h3 className="text-base font-semibold text-ink">Catat konten yang sudah dipublikasikan</h3>
        <p className="mt-1 text-xs text-ink-subtle">Pilih akun lalu lengkapi tautan atau bukti sesuai jenis konten. Kaitan kegiatan bersifat opsional.</p>
      </div>
      {activeAccounts.length === 0 ? (
        <p role="status" className="rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 p-3 text-sm text-ink-subtle">Belum ada akun media sosial aktif. Hubungi Guru Pembina untuk mengatur akun resmi.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="social-publication-account">Akun resmi *</Label><Select value={accountId} onValueChange={(value) => { if (value) { setAccountId(value); setError(''); } }}><SelectTrigger id="social-publication-account" className="min-h-11"><SelectValue placeholder="Pilih akun" /></SelectTrigger><SelectContent>{accountOptions.map((account) => <SelectItem key={account.id} value={account.id}>{account.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label htmlFor="social-publication-type">Jenis konten *</Label><Select value={effectiveContentType} onValueChange={(value) => { if (value && availableContentTypes.includes(value as PublicationType)) { setContentType(value as PublicationType); setError(''); } }}><SelectTrigger id="social-publication-type" className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{availableContentTypes.map((type) => <SelectItem key={type} value={type}>{SOCIAL_CONTENT_LABELS[type]}</SelectItem>)}</SelectContent></Select></div>
            <label className="space-y-1 text-xs text-ink-subtle"><span>Tanggal tayang *</span><Input type="date" max={jakartaToday()} value={publishedAt} onChange={(event) => setPublishedAt(event.target.value)} className="min-h-11" /></label>
            <div className="space-y-1"><Label htmlFor="social-publication-url">Tautan konten{getPlatformUrlLabel(requiresPhoto, platform)}</Label><Input id="social-publication-url" type="url" value={platformUrl} onChange={(event) => setPlatformUrl(event.target.value)} className="min-h-11" placeholder={requiresPhoto ? 'Story dibuktikan dengan foto' : 'https://'} disabled={requiresPhoto} />{!requiresPhoto && <p className="text-[11px] text-ink-tertiary">Tautan harus HTTPS dan berasal dari platform yang dipilih.</p>}</div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="social-publication-caption">Uraian konten *</Label><Textarea id="social-publication-caption" rows={3} value={caption} onChange={(event) => setCaption(event.target.value)} className="min-h-24" placeholder="Ringkas isi konten yang sudah tayang" /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="social-publication-activity">Kaitan kegiatan SP (opsional)</Label><Select value={agendaActivityId || 'none'} onValueChange={(value) => setAgendaActivityId(value === 'none' ? '' : value ?? '')}><SelectTrigger id="social-publication-activity" className="min-h-11"><SelectValue placeholder="Tidak dikaitkan" /></SelectTrigger><SelectContent><SelectItem value="none">Tidak dikaitkan dengan agenda</SelectItem>{activities.map((activity) => <SelectItem key={activity.id} value={activity.id}>{activity.activity_date} · {activity.activity_name}</SelectItem>)}</SelectContent></Select><p className="text-[11px] text-ink-tertiary">Gunakan Agenda untuk kegiatan resmi; konten rutin tetap dapat dicatat tanpa kaitan.</p></div>
          </div>
          {(requiresPhoto || platform === 'whatsapp') && <EvidenceFileField id="social-publication-evidence" label={platform === 'whatsapp' ? 'Foto bukti Channel WhatsApp (wajib jika tautan tidak tersedia)' : 'Foto bukti Story'} value={evidence} onChange={setEvidence} required={requiresPhoto || (platform === 'whatsapp' && !platformUrl.trim())} disabled={isSaving} helperText="Foto atau tangkapan layar privat; JPEG, PNG, atau WebP maksimal 5 MB." />}
          {error && <p role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 p-3 text-sm text-semantic-danger">{error}</p>}
          <div className="flex justify-end border-t border-hairline pt-3"><Button type="submit" disabled={isSaving || !selectedAccount} className="min-h-12 w-full sm:w-auto"><span className="inline-flex items-center gap-2">{isSaving ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}{isSaving ? 'Menyimpan...' : 'Simpan publikasi'}</span></Button></div>
        </>
      )}
    </form>
  );
}
