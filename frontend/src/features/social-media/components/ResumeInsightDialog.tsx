import { useMemo, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { getErrorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/primitives/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { EvidenceFileField } from './EvidenceFileField';
import type { SocialInsightPeriod } from '../types/socialMedia.types';
import { SOCIAL_PLATFORM_LABELS } from '../utils/publicationRules';

interface ResumeInsightDialogProps {
  period: SocialInsightPeriod | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (period: SocialInsightPeriod, evidence: File | null) => Promise<void>;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

export function ResumeInsightDialog({ period, onOpenChange, onSubmit }: ResumeInsightDialogProps) {
  const [evidence, setEvidence] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const attachedEvidenceCount = useMemo(() => period?.evidence.filter((item) => item.upload_status === 'attached').length ?? 0, [period]);

  const submit = async () => {
    if (!period) return;
    setError('');
    if (attachedEvidenceCount === 0 && !evidence) {
      setError('Unggah minimal satu screenshot grafik sebelum menyelesaikan insight.');
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit(period, evidence);
      setEvidence(null);
      onOpenChange(false);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSaving(false);
    }
  };

  return <Dialog open={Boolean(period)} onOpenChange={(open) => { if (!open) { setEvidence(null); setError(''); } onOpenChange(open); }}>
    <DialogContent className="max-w-lg border-hairline bg-surface-1 p-0 text-ink">
      <DialogHeader className="border-b border-hairline px-4 py-4 pr-11 sm:px-5">
        <DialogTitle>Lanjutkan draft insight</DialogTitle>
        <DialogDescription>Tambahkan screenshot grafik bila belum tersimpan, lalu selesaikan draft yang sama tanpa membuat periode duplikat.</DialogDescription>
      </DialogHeader>
      <div className="max-h-[65dvh] space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        {period && <div className="rounded-lg border border-hairline bg-surface-2 p-3">
          <p className="text-xs text-ink-subtle">{SOCIAL_PLATFORM_LABELS[period.platform]} · {formatDate(period.period_start)} – {formatDate(period.period_end)}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {([
              ['Views', period.views], ['Jangkauan', period.reach], ['Interaksi', period.interactions],
              ['Kunjungan profil', period.profile_visits], ['Konten tayang', period.published_count],
            ] as const).map(([label, value]) => <div key={label}><dt className="text-ink-tertiary">{label}</dt><dd className="font-semibold text-ink">{value === null ? 'Belum dicatat' : value.toLocaleString('id-ID')}</dd></div>)}
          </dl>
          {period.notes && <p className="mt-3 whitespace-pre-wrap text-xs text-ink-subtle">{period.notes}</p>}
          <p className="mt-3 text-xs text-ink-tertiary">{attachedEvidenceCount} screenshot grafik sudah tersimpan</p>
        </div>}
        {period && <EvidenceFileField id="social-resume-insight-evidence" label={attachedEvidenceCount > 0 ? 'Tambahkan screenshot (opsional)' : 'Screenshot grafik akun *'} value={evidence} onChange={setEvidence} required={attachedEvidenceCount === 0} disabled={isSaving} helperText="Unggah bukti baru bila draft belum memiliki screenshot. JPEG, PNG, atau WebP maksimal 5 MB; gambar tidak dikompres agar angka tetap terbaca." />}
        {error && <p role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 p-3 text-sm text-semantic-danger">{error}</p>}
      </div>
      <DialogFooter className="border-t border-hairline bg-surface-2/45 px-4 py-3 sm:px-5 md:pb-3">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>Batal</Button>
        <Button type="button" onClick={() => void submit()} disabled={!period || isSaving} className="min-h-11"><span className="inline-flex items-center gap-2">{isSaving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <BarChart3 size={15} aria-hidden="true" />}{isSaving ? 'Menyimpan...' : 'Selesaikan insight'}</span></Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
