import { useRef, useState, type FormEvent } from 'react';
import { BarChart3, Loader2, Users } from 'lucide-react';
import { getErrorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { FormattedNumberInput } from '@/shared/ui/FormattedNumberInput';
import { Label } from '@/shared/ui/primitives/label';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { formatRoleLabel } from '@/shared/utils/formatLabels';
import { EvidenceFileField } from './EvidenceFileField';
import {
  useCreateSocialInsightMutation,
  useCreateSocialSnapshotMutation,
  useFinalizeSocialInsightMutation,
  useUploadInsightEvidenceMutation,
} from '../hooks/useSocialMediaQueries';
import type { CreateInsightPeriodInput, SocialAccount } from '../types/socialMedia.types';
import { getJakartaToday } from '../utils/socialMediaDates';

type GrowthMode = 'audience' | 'insights';

interface PendingInsightWorkflow {
  signature: string;
  createKey: string;
  uploadKey: string;
  finalizeKey: string;
  id?: string;
  version?: number;
}

function numberOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}

function AccountSelector({ accounts, value, onChange, id }: { accounts: SocialAccount[]; value: string; onChange: (value: string) => void; id: string }) {
  const activeAccounts = accounts.filter((account) => account.is_active);
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Akun resmi *</Label>
      <Select value={value} onValueChange={(next) => { if (next) onChange(next); }}>
        <SelectTrigger id={id} className="min-h-11"><SelectValue placeholder="Pilih akun" /></SelectTrigger>
        <SelectContent>{activeAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{formatRoleLabel(account.platform)} · {account.account_name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function AudienceSnapshotForm({ accounts }: { accounts: SocialAccount[] }) {
  const createSnapshot = useCreateSocialSnapshotMutation();
  const [accountId, setAccountId] = useState(accounts.find((account) => account.is_active)?.id ?? '');
  const [date, setDate] = useState(getJakartaToday());
  const [audience, setAudience] = useState('');
  const [error, setError] = useState('');
  const activeAccounts = accounts.filter((account) => account.is_active);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const count = numberOrUndefined(audience);
    if (!activeAccounts.some((account) => account.id === accountId)) { setError('Pilih akun resmi yang aktif.'); return; }
    if (!date || date > getJakartaToday()) { setError('Tanggal pencatatan wajib diisi dan tidak boleh di masa depan.'); return; }
    if (count === undefined) { setError('Jumlah pengikut harus berupa bilangan bulat nol atau lebih.'); return; }
    try {
      await createSnapshot.mutateAsync({
        input: { social_account_id: accountId, as_of_date: date, audience_count: count },
        idempotencyKey: crypto.randomUUID(),
      });
      setAudience('');
      setDate(getJakartaToday());
    } catch (submitError) { setError(getErrorMessage(submitError)); }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-hairline bg-surface-1 p-4" aria-label="Form catat jumlah pengikut">
      <div><h3 className="font-semibold text-ink">Catat jumlah pengikut</h3><p className="mt-1 text-xs text-ink-subtle">Masukkan angka yang terlihat di profil akun. Sistem membandingkan dengan catatan sebelumnya bila tersedia.</p></div>
      {activeAccounts.length === 0 ? <p role="status" className="rounded-lg border border-dashed border-hairline p-3 text-sm text-ink-subtle">Tambahkan akun resmi terlebih dahulu.</p> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          <AccountSelector accounts={accounts} value={accountId} onChange={setAccountId} id="social-snapshot-account" />
          <label className="space-y-1 text-xs text-ink-subtle"><span>Tanggal data *</span><Input type="date" max={getJakartaToday()} value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11" /></label>
          <label className="space-y-1 text-xs text-ink-subtle sm:col-span-2"><span>Jumlah pengikut / subscribers *</span><FormattedNumberInput inputMode="numeric" min="0" step="1" value={numberOrUndefined(audience)} onChange={(value) => setAudience(value === undefined ? '' : String(value))} className="min-h-11" placeholder="Contoh: 1250" /></label>
        </div>
        {error && <p role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 p-3 text-sm text-semantic-danger">{error}</p>}
        <div className="flex justify-end border-t border-hairline pt-3"><Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={createSnapshot.isPending}><span className="inline-flex items-center gap-2">{createSnapshot.isPending ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Users size={16} aria-hidden="true" />}{createSnapshot.isPending ? 'Menyimpan...' : 'Simpan jumlah pengikut'}</span></Button></div>
      </>}
    </form>
  );
}

function InsightPeriodForm({ accounts }: { accounts: SocialAccount[] }) {
  const createInsight = useCreateSocialInsightMutation();
  const uploadEvidence = useUploadInsightEvidenceMutation();
  const finalizeInsight = useFinalizeSocialInsightMutation();
  const workflow = useRef<PendingInsightWorkflow | null>(null);
  const [accountId, setAccountId] = useState(accounts.find((account) => account.is_active)?.id ?? '');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState(getJakartaToday());
  const [views, setViews] = useState('');
  const [reach, setReach] = useState('');
  const [interactions, setInteractions] = useState('');
  const [profileVisits, setProfileVisits] = useState('');
  const [publishedCount, setPublishedCount] = useState('');
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeAccounts = accounts.filter((account) => account.is_active);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const numericFields = [views, reach, interactions, profileVisits, publishedCount];
    const parsed = numericFields.map(numberOrUndefined);
    if (!activeAccounts.some((account) => account.id === accountId)) { setError('Pilih akun resmi yang aktif.'); return; }
    if (!periodStart || !periodEnd || periodStart > periodEnd || periodEnd > getJakartaToday()) { setError('Periode wajib valid, berurutan, dan tidak boleh berakhir di masa depan.'); return; }
    if (numericFields.some((value, index) => value.trim() && parsed[index] === undefined)) { setError('Semua metrik harus berupa bilangan bulat nol atau lebih.'); return; }
    if (!evidence) { setError('Unggah minimal satu screenshot grafik sebagai bukti.'); return; }

    const input: CreateInsightPeriodInput = {
      social_account_id: accountId,
      period_start: periodStart,
      period_end: periodEnd,
      ...(parsed[0] !== undefined ? { views: parsed[0] } : {}),
      ...(parsed[1] !== undefined ? { reach: parsed[1] } : {}),
      ...(parsed[2] !== undefined ? { interactions: parsed[2] } : {}),
      ...(parsed[3] !== undefined ? { profile_visits: parsed[3] } : {}),
      ...(parsed[4] !== undefined ? { published_count: parsed[4] } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    const signature = JSON.stringify({ input, file: [evidence.name, evidence.size, evidence.lastModified] });
    const pending = workflow.current?.signature === signature ? workflow.current : {
      signature,
      createKey: crypto.randomUUID(),
      uploadKey: crypto.randomUUID(),
      finalizeKey: crypto.randomUUID(),
    };
    workflow.current = pending;

    setIsSubmitting(true);
    try {
      let id = pending.id;
      let version = pending.version;
      if (!id || version === undefined) {
        const saved = await createInsight.mutateAsync({ input, idempotencyKey: pending.createKey });
        id = saved.id;
        version = saved.version;
        workflow.current = { ...pending, id, version };
      }
      await uploadEvidence.mutateAsync({ id, file: evidence, idempotencyKey: pending.uploadKey });
      await finalizeInsight.mutateAsync({ id, version, idempotencyKey: pending.finalizeKey });
      workflow.current = null;
      setPeriodStart('');
      setPeriodEnd(getJakartaToday());
      setViews(''); setReach(''); setInteractions(''); setProfileVisits(''); setPublishedCount('');
      setNotes(''); setEvidence(null);
    } catch (submitError) {
      setError(`${getErrorMessage(submitError)} Data draft tetap tersimpan; coba ulangi dengan isian dan gambar yang sama agar tidak membuat entri ganda.`);
    } finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-hairline bg-surface-1 p-4" aria-label="Form catat insight akun">
      <div><h3 className="font-semibold text-ink">Catat grafik dan insight akun</h3><p className="mt-1 text-xs text-ink-subtle">Isi angka dari dashboard platform dan unggah screenshot grafik. Periode hanya dicatat setelah bukti berhasil diunggah.</p></div>
      {activeAccounts.length === 0 ? <p role="status" className="rounded-lg border border-dashed border-hairline p-3 text-sm text-ink-subtle">Tambahkan akun resmi terlebih dahulu.</p> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          <AccountSelector accounts={accounts} value={accountId} onChange={setAccountId} id="social-insight-account" />
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-ink-subtle"><span>Awal periode *</span><Input type="date" max={getJakartaToday()} value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="min-h-11" /></label>
            <label className="space-y-1 text-xs text-ink-subtle"><span>Akhir periode *</span><Input type="date" max={getJakartaToday()} value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="min-h-11" /></label>
          </div>
          {([
            ['views', 'Views / tayangan', views, setViews],
            ['reach', 'Jangkauan', reach, setReach],
            ['interactions', 'Interaksi', interactions, setInteractions],
            ['profile-visits', 'Kunjungan profil', profileVisits, setProfileVisits],
            ['published-count', 'Konten dipublikasikan', publishedCount, setPublishedCount],
          ] as const).map(([id, label, value, setter]) => <label key={id} className="space-y-1 text-xs text-ink-subtle"><span>{label}</span><FormattedNumberInput id={`social-${id}`} inputMode="numeric" min="0" step="1" value={numberOrUndefined(value)} onChange={(nextValue) => setter(nextValue === undefined ? '' : String(nextValue))} className="min-h-11" placeholder="Opsional" /></label>)}
          <label className="space-y-1 text-xs text-ink-subtle sm:col-span-2"><span>Catatan (opsional)</span><Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20" placeholder="Contoh: data diambil dari Instagram Insights" /></label>
        </div>
        <EvidenceFileField id="social-insight-evidence" label="Screenshot grafik akun *" value={evidence} onChange={setEvidence} required disabled={isSubmitting} helperText="Ambil dari galeri atau kamera; JPEG, PNG, WebP maksimal 5 MB. Gambar tidak dikompres supaya angka grafik tetap terbaca." />
        {error && <p role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 p-3 text-sm text-semantic-danger">{error}</p>}
        <div className="flex justify-end border-t border-hairline pt-3"><Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={isSubmitting || createInsight.isPending || uploadEvidence.isPending || finalizeInsight.isPending}><span className="inline-flex items-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <BarChart3 size={16} aria-hidden="true" />}{isSubmitting ? 'Menyimpan bukti...' : 'Simpan insight dan grafik'}</span></Button></div>
      </>}
    </form>
  );
}

export function SocialGrowthForms({ accounts }: { accounts: SocialAccount[] }) {
  const [mode, setMode] = useState<GrowthMode>('audience');
  return (
    <section className="space-y-4" aria-label="Pencatatan pertumbuhan akun">
      <div className="inline-flex rounded-lg border border-hairline bg-surface-2 p-1" role="tablist" aria-label="Jenis data pertumbuhan">
        <button type="button" role="tab" aria-selected={mode === 'audience'} onClick={() => setMode('audience')} className={`min-h-10 rounded-md px-3 text-sm ${mode === 'audience' ? 'bg-surface-1 font-semibold text-ink shadow-sm' : 'text-ink-subtle'}`}>Jumlah pengikut</button>
        <button type="button" role="tab" aria-selected={mode === 'insights'} onClick={() => setMode('insights')} className={`min-h-10 rounded-md px-3 text-sm ${mode === 'insights' ? 'bg-surface-1 font-semibold text-ink shadow-sm' : 'text-ink-subtle'}`}>Grafik & insight</button>
      </div>
      {mode === 'audience' ? <AudienceSnapshotForm accounts={accounts} /> : <InsightPeriodForm accounts={accounts} />}
    </section>
  );
}
