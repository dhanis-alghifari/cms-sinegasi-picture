import { useEffect, useMemo, useState } from 'react';
import { FileImage, FilePlus2, FileText, Loader2, Plus, Send, Trash2, Trophy, Upload } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getErrorMessage } from '@/shared/api/errors';
import { cn } from '@/lib/utils';

import { useContestEntriesQuery } from '../queries/useContestEntriesQuery';
import { useContestWorkTypesQuery } from '../queries/useContestWorkTypesQuery';
import { useCreateContestEntryMutation } from '../mutations/useCreateContestEntryMutation';
import { useTransitionContestEntryMutation } from '../mutations/useTransitionContestEntryMutation';
import { useFinalizeContestEntryMutation } from '../mutations/useFinalizeContestEntryMutation';
import { createContestEntrySchema, type CreateContestEntryFormValues } from '../schemas/contestSchema';
import type { Contest, ContestEntry, ContestEntryStatus, ContestFinalizeResultKind, WorkTypeCode } from '../types/contests.types';
import { CONTEST_ENTRY_STATUS_BADGE_CLASSES, getContestEntryStatusLabel } from '../utils/contestLabels';

interface ContestEntriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contest?: Contest | null;
}

type NextStatus = Extract<ContestEntryStatus, 'sudah_terkirim' | 'menunggu_pengumuman' | 'selesai'>;
type OutcomeStatus = 'awarded' | 'not_awarded';
type ResultRow = { result_kind: ContestFinalizeResultKind; result_title: string; position: string };

const NEXT_STATUS: Record<ContestEntryStatus, NextStatus | null> = {
  proses_submit: 'sudah_terkirim',
  sudah_terkirim: 'menunggu_pengumuman',
  menunggu_pengumuman: 'selesai',
  selesai: null,
};

const RESULT_KIND_OPTIONS: ReadonlyArray<{ value: ContestFinalizeResultKind; label: string }> = [
  { value: 'rank', label: 'Juara' },
  { value: 'finalist', label: 'Finalis' },
  { value: 'nominee', label: 'Nominasi' },
  { value: 'other', label: 'Lainnya' },
];

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const newResultRow = (): ResultRow => ({ result_kind: 'rank', result_title: '', position: '1' });

export function ContestEntriesDialog({ open, onOpenChange, contest }: ContestEntriesDialogProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ContestEntry | null>(null);
  const [transitionStatus, setTransitionStatus] = useState<NextStatus>('sudah_terkirim');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const [outcomeStatus, setOutcomeStatus] = useState<OutcomeStatus>('awarded');
  const [resultRows, setResultRows] = useState<ResultRow[]>([newResultRow()]);
  const [formError, setFormError] = useState<string | null>(null);

  const entriesQuery = useContestEntriesQuery(contest?.id, { page: 1, pageSize: 50 }, open);
  const workTypesQuery = useContestWorkTypesQuery(open);
  const createMutation = useCreateContestEntryMutation();
  const transitionMutation = useTransitionContestEntryMutation();
  const finalizeMutation = useFinalizeContestEntryMutation();
  const form = useForm<CreateContestEntryFormValues>({
    resolver: zodResolver(createContestEntrySchema),
    defaultValues: { title: '', work_type_code: 'short_film' },
  });
  const selectedType = useWatch({ control: form.control, name: 'work_type_code' });

  useEffect(() => () => {
    if (evidencePreview) URL.revokeObjectURL(evidencePreview);
  }, [evidencePreview]);

  const workTypes = workTypesQuery.data ?? [];
  const selectedWorkTypeLabel = workTypes.find((item) => item.code === selectedType)?.label ?? 'Pilih jenis karya';
  const resultKindLabels = useMemo(
    () => Object.fromEntries(RESULT_KIND_OPTIONS.map((item) => [item.value, item.label])) as Record<ContestFinalizeResultKind, string>,
    [],
  );

  const clearEvidence = () => {
    if (evidencePreview) URL.revokeObjectURL(evidencePreview);
    setEvidencePreview(null);
    setEvidenceFile(null);
  };

  const closeEditor = () => {
    clearEvidence();
    setEditingEntry(null);
    setFormError(null);
  };

  const startTransition = (entry: ContestEntry) => {
    const nextStatus = NEXT_STATUS[entry.pipeline_status];
    if (!nextStatus) return;
    clearEvidence();
    setEditingEntry(entry);
    setTransitionStatus(nextStatus);
    setChangeReason('');
    setOutcomeStatus('awarded');
    setResultRows([newResultRow()]);
    setFormError(null);
    setShowCreateForm(false);
  };

  const selectEvidence = (file?: File) => {
    clearEvidence();
    setFormError(null);
    if (!file) return;
    if (!ALLOWED_EVIDENCE_TYPES.has(file.type) || file.size < 1 || file.size > MAX_EVIDENCE_BYTES) {
      setFormError('Bukti harus berupa JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.');
      return;
    }
    setEvidenceFile(file);
    setEvidencePreview(URL.createObjectURL(file));
  };

  const submitCreate = form.handleSubmit(async (values) => {
    if (!contest) return;
    await createMutation.mutateAsync({
      contestId: contest.id,
      payload: { work: { title: values.title, work_type_code: values.work_type_code } },
    });
    form.reset({ title: '', work_type_code: 'short_film' });
    setShowCreateForm(false);
  });

  const submitTransition = async () => {
    if (!editingEntry) return;
    const reason = changeReason.trim();
    if (reason.length < 5) return setFormError('Alasan perubahan minimal 5 karakter.');
    if ((transitionStatus === 'sudah_terkirim' || transitionStatus === 'selesai') && !evidenceFile) {
      return setFormError('Unggah screenshot atau foto bukti terlebih dahulu.');
    }
    if (transitionStatus === 'selesai' && outcomeStatus === 'awarded') {
      if (resultRows.length === 0 || resultRows.some((row) => row.result_title.trim().length < 2)) {
        return setFormError('Isi minimal satu nama penghargaan.');
      }
      if (resultRows.some((row) => row.result_kind === 'rank' && Number(row.position) < 1)) {
        return setFormError('Posisi wajib diisi untuk hasil Juara.');
      }
    }
    setFormError(null);
    if (transitionStatus === 'selesai') {
      await finalizeMutation.mutateAsync({
        entryId: editingEntry.id,
        evidenceFile: evidenceFile as File,
        payload: {
          outcome_status: outcomeStatus,
          results: outcomeStatus === 'awarded'
            ? resultRows.map((row) => ({
              result_kind: row.result_kind,
              result_title: row.result_title.trim(),
              position: row.result_kind === 'rank' ? Number(row.position) : null,
            }))
            : [],
          change_reason: reason,
        },
      });
    } else {
      await transitionMutation.mutateAsync({
        entryId: editingEntry.id,
        evidenceFile: transitionStatus === 'sudah_terkirim' ? evidenceFile ?? undefined : undefined,
        payload: { status: transitionStatus, change_reason: reason },
      });
    }
    closeEditor();
  };

  const entries = entriesQuery.data?.data ?? [];
  const requestError = entriesQuery.error || workTypesQuery.error || createMutation.error || transitionMutation.error || finalizeMutation.error;
  const isSaving = transitionMutation.isPending || finalizeMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden bg-surface-1 p-0 text-ink">
        <DialogHeader className="border-b border-hairline px-6 py-5">
          <div className="flex items-center gap-2 pr-6">
            <FileText size={18} className="text-primary" aria-hidden="true" />
            <DialogTitle className="text-base font-semibold">Karya untuk {contest?.nama_lomba ?? 'event'}</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-ink-subtle">Tambahkan karya, unggah bukti pengiriman, lalu pantau hasilnya sampai selesai.</DialogDescription>
        </DialogHeader>

        <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={(event) => event.preventDefault()}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {(requestError || formError) && <div role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 px-3 py-2 text-xs text-semantic-danger">{formError ?? getErrorMessage(requestError)}</div>}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-2 p-4">
            <div><p className="text-sm font-semibold text-ink">Daftar karya</p><p className="mt-0.5 text-xs text-ink-tertiary">{entriesQuery.isLoading ? 'Memuat...' : `${entriesQuery.data?.total ?? 0} karya terdaftar`}</p></div>
            <Button type="button" size="sm" onClick={() => { setShowCreateForm((value) => !value); closeEditor(); }} className="gap-1.5"><Plus size={14} /> {showCreateForm ? 'Tutup form' : 'Tambah karya'}</Button>
          </div>

          {showCreateForm && (
            <div className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
              <div><p className="text-sm font-semibold text-ink">Tambah karya</p><p className="mt-0.5 text-xs text-ink-tertiary">Satu event dapat memiliki beberapa karya.</p></div>
              <div className="space-y-1.5">
                <Label htmlFor="work-title" className="text-xs text-ink-muted">Judul karya *</Label>
                <Input id="work-title" {...form.register('title')} placeholder="Contoh: Jejak di Atas Kanvas" className={cn('h-11 bg-surface-1 text-sm', form.formState.errors.title && 'border-semantic-danger')} />
                {form.formState.errors.title && <p className="text-[11px] text-semantic-danger">{form.formState.errors.title.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-ink-muted">Jenis karya *</Label>
                <Select value={selectedType} onValueChange={(value) => value && form.setValue('work_type_code', value as WorkTypeCode, { shouldValidate: true })}>
                  <SelectTrigger className="h-11 bg-surface-1 text-sm"><SelectValue>{selectedWorkTypeLabel}</SelectValue></SelectTrigger>
                  <SelectContent className="bg-surface-3 text-ink">{workTypes.map((type) => <SelectItem key={type.code} value={type.code}>{type.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>Batal</Button><Button type="button" size="sm" disabled={createMutation.isPending} onClick={() => void submitCreate()}>{createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <FilePlus2 size={14} />} Simpan karya</Button></div>
            </div>
          )}

          <div className="space-y-2">
            {entriesQuery.isLoading ? <div className="py-10 text-center text-xs text-ink-tertiary">Memuat daftar karya...</div> : entries.length === 0 ? <div className="rounded-xl border border-dashed border-hairline px-4 py-10 text-center text-xs text-ink-tertiary">Belum ada karya untuk event ini.</div> : entries.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-hairline bg-surface-2 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-ink">{entry.work?.title ?? 'Karya tanpa judul'}</p><Badge variant="outline" className={cn('text-[10px]', CONTEST_ENTRY_STATUS_BADGE_CLASSES[entry.pipeline_status])}>{getContestEntryStatusLabel(entry.pipeline_status)}</Badge></div>
                    <p className="mt-1 text-xs text-ink-tertiary">{entry.work?.work_type_label ?? workTypes.find((type) => type.code === entry.work?.work_type_code)?.label ?? 'Jenis karya'}</p>
                    {entry.result_label && <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-semantic-warning"><Trophy size={13} /> {entry.result_label}</p>}
                  </div>
                  {entry.pipeline_status === 'selesai' ? <span className="text-xs text-ink-tertiary">Pipeline selesai</span> : <Button type="button" variant="outline" size="sm" onClick={() => startTransition(entry)} className="self-start text-xs sm:self-center"><Send size={13} /> Perbarui pipeline</Button>}
                </div>
              </article>
            ))}
          </div>

          {editingEntry && (
            <section className="space-y-4 rounded-xl border border-semantic-warning/30 bg-semantic-warning/5 p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-ink">Perbarui pipeline</p><p className="mt-0.5 text-xs text-ink-tertiary">{editingEntry.work?.title}</p></div><Button type="button" variant="ghost" size="sm" onClick={closeEditor}>Tutup</Button></div>

              <div className="space-y-1.5">
                <Label className="text-xs text-ink-muted">Status berikutnya</Label>
                <Select value={transitionStatus} disabled><SelectTrigger className="h-11 bg-surface-1 text-sm"><SelectValue>{getContestEntryStatusLabel(transitionStatus)}</SelectValue></SelectTrigger><SelectContent><SelectItem value={transitionStatus}>{getContestEntryStatusLabel(transitionStatus)}</SelectItem></SelectContent></Select>
                <p className="text-[11px] text-ink-tertiary">Pipeline diperbarui berurutan agar riwayat tetap akurat.</p>
              </div>

              {(transitionStatus === 'sudah_terkirim' || transitionStatus === 'selesai') && (
                <div className="space-y-2">
                  <Label htmlFor="contest-evidence" className="text-xs text-ink-muted">Screenshot / foto bukti *</Label>
                  <label htmlFor="contest-evidence" className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-surface-1 px-4 py-5 text-center transition-colors hover:border-primary/60 hover:bg-primary/5">
                    {evidencePreview ? <img src={evidencePreview} alt="Pratinjau bukti" className="max-h-44 rounded-lg object-contain" /> : <Upload size={22} className="text-primary" />}
                    <span className="text-xs font-medium text-ink">{evidenceFile?.name ?? 'Pilih screenshot atau foto bukti'}</span><span className="text-[11px] text-ink-tertiary">JPG, PNG, atau WebP · maksimal 5 MB</span>
                  </label>
                  <input id="contest-evidence" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => selectEvidence(event.target.files?.[0])} />
                  {evidenceFile && <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearEvidence}><FileImage size={13} /> Ganti / hapus bukti</Button>}
                </div>
              )}

              {transitionStatus === 'selesai' && (
                <div className="space-y-4 rounded-xl border border-hairline bg-surface-1 p-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-ink-muted">Status prestasi *</Label>
                    <Select value={outcomeStatus} onValueChange={(value) => value && setOutcomeStatus(value as OutcomeStatus)}><SelectTrigger className="h-11 bg-surface-2 text-sm"><SelectValue>{outcomeStatus === 'awarded' ? 'Mendapat penghargaan' : 'Tidak mendapat penghargaan'}</SelectValue></SelectTrigger><SelectContent className="bg-surface-3 text-ink"><SelectItem value="awarded">Mendapat penghargaan</SelectItem><SelectItem value="not_awarded">Tidak mendapat penghargaan</SelectItem></SelectContent></Select>
                  </div>

                  {outcomeStatus === 'awarded' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-ink">Hasil penghargaan</p><p className="text-[11px] text-ink-tertiary">Tambahkan semua hasil yang diperoleh karya ini.</p></div><Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-[11px]" onClick={() => setResultRows((rows) => [...rows, newResultRow()])}><Plus size={12} /> Tambah hasil</Button></div>
                      {resultRows.map((row, index) => (
                        <div key={`result-${index}`} className="space-y-3 rounded-lg border border-hairline bg-surface-2 p-3">
                          <div className="flex items-center justify-between"><p className="text-xs font-medium text-ink">Hasil {index + 1}</p><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-semantic-danger" aria-label={`Hapus hasil ${index + 1}`} onClick={() => setResultRows((rows) => rows.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></Button></div>
                          <div className="space-y-1.5"><Label htmlFor={`result-title-${index}`} className="text-xs text-ink-muted">Nama penghargaan *</Label><Input id={`result-title-${index}`} value={row.result_title} onChange={(event) => setResultRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, result_title: event.target.value } : item))} placeholder="Contoh: Best Student Short Film" className="h-11 bg-surface-1 text-sm" /></div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label className="text-xs text-ink-muted">Jenis hasil *</Label><Select value={row.result_kind} onValueChange={(value) => value && setResultRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, result_kind: value as ContestFinalizeResultKind, position: value === 'rank' ? item.position || '1' : '' } : item))}><SelectTrigger className="h-11 bg-surface-1 text-sm"><SelectValue>{resultKindLabels[row.result_kind]}</SelectValue></SelectTrigger><SelectContent className="bg-surface-3 text-ink">{RESULT_KIND_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-1.5"><Label htmlFor={`result-position-${index}`} className="text-xs text-ink-muted">Posisi {row.result_kind === 'rank' ? '*' : '(tidak diperlukan)'}</Label><Input id={`result-position-${index}`} value={row.position} disabled={row.result_kind !== 'rank'} onChange={(event) => setResultRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, position: event.target.value.replace(/\D/g, '') } : item))} placeholder="Contoh: 1" inputMode="numeric" className="h-11 bg-surface-1 text-sm" /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5"><Label htmlFor="entry-change-reason" className="text-xs text-ink-muted">Alasan perubahan *</Label><Textarea id="entry-change-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} rows={2} placeholder="Contoh: Bukti pengiriman dari formulir pendaftaran sudah diterima" className="bg-surface-1 text-sm" /></div>
              <div className="flex justify-end"><Button type="button" size="sm" disabled={isSaving} onClick={() => void submitTransition()}>{isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Simpan status</Button></div>
            </section>
          )}
        </div>

        <DialogFooter className="border-t border-hairline bg-surface-1 px-6 py-4"><Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Tutup</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
