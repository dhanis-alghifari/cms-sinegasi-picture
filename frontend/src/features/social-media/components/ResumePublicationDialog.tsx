import { useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { getErrorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/primitives/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { EvidenceFileField } from './EvidenceFileField';
import type { SocialPublication } from '../types/socialMedia.types';
import { getPublicationValidationError, isAllowedPlatformUrl, isStoryPublication, SOCIAL_CONTENT_LABELS, SOCIAL_PLATFORM_LABELS } from '../utils/publicationRules';

interface ResumePublicationDialogProps {
  publication: SocialPublication | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (publication: SocialPublication, evidence: File | null) => Promise<void>;
}

export function ResumePublicationDialog({ publication, onOpenChange, onSubmit }: ResumePublicationDialogProps) {
  const [evidence, setEvidence] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const attachedEvidenceCount = useMemo(() => publication?.evidence.filter((item) => item.upload_status === 'attached').length ?? 0, [publication]);
  const evidenceRequired = Boolean(publication && (
    isStoryPublication(publication.platform, publication.content_type)
    || (publication.platform === 'whatsapp' && !isAllowedPlatformUrl('whatsapp', publication.platform_url ?? ''))
  ));
  const validationError = publication ? getPublicationValidationError({
    platform: publication.platform,
    contentType: publication.content_type,
    platformUrl: publication.platform_url ?? '',
    evidenceCount: attachedEvidenceCount + (evidence ? 1 : 0),
  }) : null;

  const submit = async () => {
    if (!publication) return;
    setError('');
    if (validationError) { setError(validationError); return; }
    setIsSaving(true);
    try {
      await onSubmit(publication, evidence);
      setEvidence(null);
      onOpenChange(false);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally { setIsSaving(false); }
  };

  return <Dialog open={Boolean(publication)} onOpenChange={(open) => { if (!open) { setEvidence(null); setError(''); } onOpenChange(open); }}>
    <DialogContent className="max-w-lg border-hairline bg-surface-1 p-0 text-ink">
      <DialogHeader className="border-b border-hairline px-4 py-4 pr-11 sm:px-5">
        <DialogTitle>Lanjutkan draft publikasi</DialogTitle>
        <DialogDescription>Tambahkan bukti yang belum ada lalu selesaikan pencatatan tanpa membuat publikasi duplikat.</DialogDescription>
      </DialogHeader>
      <div className="max-h-[65dvh] space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        {publication && <div className="rounded-lg border border-hairline bg-surface-2 p-3">
          <p className="text-xs text-ink-subtle">{SOCIAL_PLATFORM_LABELS[publication.platform]} · {SOCIAL_CONTENT_LABELS[publication.content_type]}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm font-semibold">{publication.caption}</p>
          <p className="mt-2 text-xs text-ink-tertiary">{attachedEvidenceCount} bukti gambar sudah tersimpan</p>
          {publication.platform_url && <a href={publication.platform_url} target="_blank" rel="noreferrer" className="mt-2 block min-h-11 break-all py-2 text-xs text-primary underline">Buka tautan publikasi</a>}
        </div>}
        {publication && <EvidenceFileField id="social-resume-evidence" label={evidenceRequired ? 'Foto/screenshot bukti *' : 'Tambahkan foto/screenshot (opsional)'} value={evidence} onChange={setEvidence} required={evidenceRequired && attachedEvidenceCount === 0} disabled={isSaving} helperText="Unggah bukti baru hanya bila belum ada atau ingin melengkapi. JPEG, PNG, atau WebP maksimal 5 MB." />}
        {validationError && !evidence && <p role="status" className="rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 p-3 text-xs text-ink-subtle">{validationError}</p>}
        {error && <p role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 p-3 text-sm text-semantic-danger">{error}</p>}
      </div>
      <DialogFooter className="border-t border-hairline bg-surface-2/45 px-4 py-3 sm:px-5 md:pb-3">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>Batal</Button>
        <Button type="button" onClick={() => void submit()} disabled={!publication || isSaving || Boolean(validationError)} className="min-h-11"><span className="inline-flex items-center gap-2">{isSaving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{isSaving ? 'Menyimpan...' : 'Selesaikan publikasi'}</span></Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
