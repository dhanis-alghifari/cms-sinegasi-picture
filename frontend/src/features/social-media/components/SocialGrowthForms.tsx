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
import { getSocialInsightMetricDefinitions, getSocialInsightPeriodLabel, getSocialInsightSourceLabel, type SocialInsightMetricKey } from '../utils/socialInsightMetrics';

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

function getPreviousCompletedMonth(): string {
  const date = new Date(`${getJakartaToday()}T00:00:00.000Z`);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function getArchiveMetricRange(month: string, platform: SocialAccount['platform']): { from: string; to: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  const fromOfMonth = `${month}-01`;
  const monthEnd = new Date(Date.UTC(year!, monthNumber!, 0)).toISOString().slice(0, 10);
  if (platform !== 'whatsapp') return { from: fromOfMonth, to: monthEnd };
  const start = new Date(Date.parse(`${monthEnd}T00:00:00.000Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  return { from: start, to: monthEnd };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
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
  const [archiveMonth, setArchiveMonth] = useState(getPreviousCompletedMonth());
  const [metrics, setMetrics] = useState<Partial<Record<SocialInsightMetricKey, string>>>({});
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeAccounts = accounts.filter((account) => account.is_active);
  const selectedAccount = activeAccounts.find((account) => account.id === accountId);
  const metricDefinitions = selectedAccount ? getSocialInsightMetricDefinitions(selectedAccount.platform) : [];
  const metricRange = selectedAccount ? getArchiveMetricRange(archiveMonth, selectedAccount.platform) : null;
  const resetInsightEntry = () => {
    setMetrics({});
    setNotes('');
    setEvidence(null);
    setError('');
    workflow.current = null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!activeAccounts.some((account) => account.id === accountId)) { setError('Pilih akun resmi yang aktif.'); return; }
    if (!archiveMonth || archiveMonth >= getJakartaToday().slice(0, 7)) { setError('Pilih bulan arsip yang sudah selesai.'); return; }
    const parsedMetrics = metricDefinitions.map(({ key }) => ({ key, raw: metrics[key] ?? '', value: numberOrUndefined(metrics[key] ?? '') }));
    if (parsedMetrics.some(({ raw, value }) => raw.trim() && value === undefined)) { setError('Semua metrik harus berupa bilangan bulat nol atau lebih.'); return; }
    if (!parsedMetrics.some(({ raw, value }) => raw.trim() && value !== undefined)) { setError('Isi setidaknya satu metrik dari platform ini.'); return; }
    if (!evidence) { setError('Unggah minimal satu screenshot grafik sebagai bukti.'); return; }

    const input: CreateInsightPeriodInput = {
      social_account_id: accountId,
      archive_month: archiveMonth,
      ...Object.fromEntries(parsedMetrics.flatMap(({ key, value }) => value === undefined ? [] : [[key, value]])),
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
      setArchiveMonth(getPreviousCompletedMonth());
      setMetrics({});
      setNotes(''); setEvidence(null);
    } catch (submitError) {
      setError(`${getErrorMessage(submitError)} Data draft tetap tersimpan; coba ulangi dengan isian dan gambar yang sama agar tidak membuat entri ganda.`);
    } finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-hairline bg-surface-1 p-4" aria-label="Form catat insight akun">
      <div><h3 className="font-semibold text-ink">Arsip bulanan grafik dan insight</h3><p className="mt-1 text-xs text-ink-subtle">Catat satu ringkasan untuk setiap akun dan bulan yang sudah selesai. Arsip baru tercatat setelah bukti dashboard berhasil diunggah.</p></div>
      {activeAccounts.length === 0 ? <p role="status" className="rounded-lg border border-dashed border-hairline p-3 text-sm text-ink-subtle">Tambahkan akun resmi terlebih dahulu.</p> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          <AccountSelector accounts={accounts} value={accountId} onChange={(value) => { setAccountId(value); resetInsightEntry(); }} id="social-insight-account" />
          <label className="space-y-1 text-xs text-ink-subtle"><span>Bulan arsip *</span><Input type="month" max={getPreviousCompletedMonth()} value={archiveMonth} onChange={(event) => { setArchiveMonth(event.target.value); resetInsightEntry(); }} className="min-h-11" /></label>
          {selectedAccount && metricRange && <div className="rounded-lg border border-hairline bg-surface-2/60 p-3 text-xs text-ink-subtle sm:col-span-2">
            <p><span className="font-medium text-ink">Sumber:</span> {getSocialInsightSourceLabel(selectedAccount.platform)}</p>
            <p className="mt-1"><span className="font-medium text-ink">Jendela data:</span> {formatDate(metricRange.from)} – {formatDate(metricRange.to)} ({getSocialInsightPeriodLabel(selectedAccount.platform)}).</p>
            {selectedAccount.platform === 'youtube' && <p className="mt-1">YouTube Studio menampilkan waktu tonton dalam jam; konversikan ke menit sebelum dicatat.</p>}
          </div>}
          {metricDefinitions.map(({ key, label }) => <label key={key} className="space-y-1 text-xs text-ink-subtle"><span>{label}</span><FormattedNumberInput id={`social-${key}`} inputMode="numeric" min="0" step="1" value={numberOrUndefined(metrics[key] ?? '')} onChange={(nextValue) => setMetrics((current) => ({ ...current, [key]: nextValue === undefined ? '' : String(nextValue) }))} className="min-h-11" placeholder="Opsional" /></label>)}
          <label className="space-y-1 text-xs text-ink-subtle sm:col-span-2"><span>Catatan sumber / konteks (opsional)</span><Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20" placeholder="Contoh: angka disalin dari tab Insights akun resmi" /></label>
        </div>
        <EvidenceFileField id="social-insight-evidence" label="Screenshot insight *" value={evidence} onChange={setEvidence} required disabled={isSubmitting} helperText="Lampirkan tangkapan dashboard platform sebagai sumber verifikasi. JPEG, PNG, WebP maksimal 5 MB; gambar tidak dikompres." />
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
