import { useState } from 'react';
import { Check, Eye, Loader2, X } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { ImagePreviewDialog } from '@/shared/ui/ImagePreviewDialog';
import { Pagination } from '@/shared/ui/Pagination';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { FormattedNumberInput } from '@/shared/ui/FormattedNumberInput';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatNumber } from '@/shared/utils/formatNumber';
import { formatDateShort } from '@/shared/utils/formatDate';
import { getErrorMessage } from '@/shared/api/errors';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { cashService } from '../api/cash.service';
import { useCashDisputesQuery, useCashPaymentMethodsQuery } from '../hooks/useCashQuery';
import { useResolveDisputeMutation } from '../hooks/useResolveDisputeMutation';
import type { CashDispute, DisputeStatus } from '../types/cash.types';

function statusLabel(status: DisputeStatus) {
  if (status === 'pending') return { label: 'Menunggu', variant: 'warning' as const };
  if (status === 'resolved' || status === 'approved') return { label: 'Disetujui', variant: 'success' as const };
  return { label: 'Ditolak', variant: 'danger' as const };
}

function safeProofUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  if (/^data:image\/(jpeg|jpg|png|webp|gif|avif|bmp);base64,/i.test(candidate)) return candidate;
  try {
    const parsed = new URL(candidate, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

type ReviewDraft = { dispute: CashDispute; status: 'approved' | 'rejected' };

export function CashDisputeQueue({ reviewer = false }: { reviewer?: boolean }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useCashDisputesQuery({ page, pageSize: UI_CONSTANTS.DEFAULT_PAGE_SIZE }, true);
  const resolveMutation = useResolveDisputeMutation();
  const paymentMethodsQuery = useCashPaymentMethodsQuery(Boolean(reviewer));
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [evidenceLoadingId, setEvidenceLoadingId] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewValidationError, setReviewValidationError] = useState<string | null>(null);
  const [resolutionDate, setResolutionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [resolutionAmount, setResolutionAmount] = useState<number | undefined>();
  const [paymentMethodCode, setPaymentMethodCode] = useState('');
  const disputes = data?.data ?? [];

  if (isLoading) return <PageLoader />;
  if (error) return <div role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 p-4 text-sm text-semantic-danger">{getErrorMessage(error)}</div>;
  if (disputes.length === 0) return <EmptyState title="Belum ada sanggahan" description={reviewer ? 'Laporan sanggahan baru akan muncul di sini.' : 'Riwayat sanggahan Anda masih kosong.'} />;

  const closeProof = () => { setSelectedProof(null); setDownloadState('idle'); };
  const openProof = async (dispute: CashDispute) => {
    setEvidenceLoadingId(dispute.id);
    setEvidenceError(null);
    try {
      const response = await cashService.getDisputeEvidence(dispute.id);
      const url = safeProofUrl(response.data.url);
      if (url) { setSelectedProof(url); setDownloadState('idle'); }
    } catch (error) {
      setEvidenceError(getErrorMessage(error));
    } finally { setEvidenceLoadingId(null); }
  };
  const openReview = (dispute: CashDispute, status: 'approved' | 'rejected') => {
    setReviewDraft({ dispute, status });
    setReviewNote('');
    setReviewValidationError(null);
    setResolutionDate(new Date().toISOString().slice(0, 10));
    setResolutionAmount(dispute.transaction_nominal ?? undefined);
    setPaymentMethodCode('');
  };
  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewDraft) return;

    const normalizedReviewNote = reviewNote.trim();
    if (normalizedReviewNote.length < 5) {
      setReviewValidationError('Catatan pemeriksaan wajib diisi minimal 5 karakter.');
      return;
    }

    const requiresResolution = reviewDraft.status === 'approved' && Boolean(reviewDraft.dispute.debt_record_id);
    if (requiresResolution && !resolutionDate) {
      setReviewValidationError('Tanggal pembayaran wajib diisi.');
      return;
    }
    if (requiresResolution && (resolutionAmount === undefined || !Number.isFinite(resolutionAmount) || resolutionAmount < 1)) {
      setReviewValidationError('Nominal pembayaran wajib diisi dan harus lebih besar dari Rp 0.');
      return;
    }
    if (requiresResolution && !paymentMethodCode) {
      setReviewValidationError('Metode pembayaran wajib dipilih.');
      return;
    }

    setReviewValidationError(null);
    await resolveMutation.mutateAsync({
      disputeId: reviewDraft.dispute.id,
      status: reviewDraft.status,
      review_note: normalizedReviewNote,
      resolution_date: requiresResolution ? resolutionDate : undefined,
      resolution_amount: requiresResolution ? resolutionAmount : undefined,
      payment_method_code: requiresResolution ? paymentMethodCode : undefined,
    });
    setReviewDraft(null);
  };
  const downloadProof = async () => {
    if (!selectedProof) return;
    setDownloadState('loading');
    try {
      const response = await fetch(selectedProof, { credentials: 'omit' });
      if (!response.ok) throw new Error('Bukti tidak dapat diunduh.');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl; anchor.download = `bukti-sanggahan-${new Date().toISOString().slice(0, 10)}.${blob.type.split('/')[1] || 'jpg'}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(objectUrl);
      setDownloadState('idle');
    } catch { setDownloadState('error'); }
  };

  const handleReviewDialogOpenChange = (open: boolean) => {
    if (!open && !resolveMutation.isPending) setReviewDraft(null);
  };

  const handleReviewFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    void submitReview(event);
  };

  const handleReviewNoteChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReviewNote(event.target.value);
    setReviewValidationError(null);
  };

  const handleResolutionDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setResolutionDate(event.target.value);
    setReviewValidationError(null);
  };

  const handleResolutionAmountChange = (value: number | undefined) => {
    setResolutionAmount(value);
    setReviewValidationError(null);
  };

  const handlePaymentMethodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setPaymentMethodCode(event.target.value);
    setReviewValidationError(null);
  };

  const handleCloseReview = () => setReviewDraft(null);

  return (
    <>
      <div className="space-y-3" aria-label="Daftar sanggahan kas">
        {evidenceError && <p role="alert" className="rounded-md border border-semantic-danger/30 bg-semantic-danger/10 px-3 py-2 text-sm text-semantic-danger">{evidenceError}</p>}
        {disputes.map((dispute) => {
          const status = statusLabel(dispute.status);
          const isPending = dispute.status === 'pending';
          const isDebt = Boolean(dispute.debt_record_id);
          return (
            <article key={dispute.id} className="rounded-xl border border-hairline bg-surface-1 p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{reviewer ? (dispute.student_nama ?? 'Siswa') : 'Laporan sanggahan kas'}</p><p className="mt-1 text-xs text-ink-tertiary">Dikirim {formatDateShort(dispute.created_at)}{dispute.transaction_tanggal ? ` · transaksi ${formatDateShort(dispute.transaction_tanggal)}` : ''} · attempt {formatNumber(dispute.attempt_number)}</p></div>
                <StatusBadge label={status.label} variant={status.variant} />
              </div>
              {dispute.transaction_nominal !== undefined && <p className="mt-3 text-sm text-ink">Nominal dipermasalahkan: <strong>{formatCurrency(dispute.transaction_nominal)}</strong></p>}
              <p className="mt-2 break-words whitespace-pre-wrap text-sm text-ink-subtle">Alasan: <strong>{dispute.reason}</strong></p>
              {dispute.review_note && <p className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-subtle"><strong>Catatan pemeriksa:</strong> {dispute.review_note}</p>}
              <div className="mt-4 flex flex-col gap-2 border-t border-hairline pt-3 sm:flex-row sm:items-center sm:justify-end">
                {reviewer && isPending && <div className="grid w-full grid-cols-2 gap-2 sm:contents"><Button type="button" size="sm" className="min-h-11 w-full border-semantic-success bg-semantic-success text-white hover:bg-semantic-success/85 sm:w-auto" disabled={resolveMutation.isPending} onClick={() => openReview(dispute, 'approved')}><Check size={14} className="mr-1" />Setujui</Button><Button type="button" size="sm" variant="outline" className="min-h-11 w-full border-semantic-danger text-semantic-danger hover:bg-semantic-danger/10 sm:w-auto" disabled={resolveMutation.isPending} onClick={() => openReview(dispute, 'rejected')}><X size={14} className="mr-1" />Tolak</Button></div>}
                <Button type="button" size="sm" variant="outline" className="min-h-11 w-full border-primary/40 text-primary hover:bg-primary/10 sm:w-auto" disabled={!dispute.has_evidence || evidenceLoadingId === dispute.id} onClick={() => void openProof(dispute)}>{evidenceLoadingId === dispute.id ? <Loader2 size={13} className="mr-1 animate-spin" /> : <Eye size={13} className="mr-1" />}{evidenceLoadingId === dispute.id ? 'Memuat bukti...' : 'Lihat bukti'}</Button>
              </div>
              {reviewer && isDebt && isPending && <p className="mt-2 text-[11px] text-ink-tertiary">Persetujuan tunggakan akan membuat transaksi pembayaran terverifikasi dan menandai tunggakan lunas secara atomik.</p>}
            </article>
          );
        })}
      </div>
      <Pagination page={data?.page ?? page} totalPages={data?.totalPages ?? 1} total={data?.total ?? disputes.length} pageSize={data?.pageSize ?? UI_CONSTANTS.DEFAULT_PAGE_SIZE} onPageChange={setPage} />

      <Dialog open={Boolean(reviewDraft)} onOpenChange={handleReviewDialogOpenChange}>
        <DialogContent className="max-w-lg border-hairline bg-surface-1 text-ink">
          <DialogHeader><DialogTitle>{reviewDraft?.status === 'approved' ? 'Setujui sanggahan' : 'Tolak sanggahan'}</DialogTitle><DialogDescription className="text-ink-subtle">Catatan pemeriksa wajib diisi dan tersimpan dalam riwayat audit.</DialogDescription></DialogHeader>
          <form noValidate onSubmit={handleReviewFormSubmit} className="space-y-4">
            <div className="space-y-1"><Label htmlFor="review-note">Catatan pemeriksaan *</Label><Textarea id="review-note" value={reviewNote} onChange={handleReviewNoteChange} minLength={5} maxLength={2000} required rows={4} placeholder="Jelaskan hasil pemeriksaan bukti..." /></div>
            {reviewDraft?.status === 'approved' && reviewDraft.dispute.debt_record_id && <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="resolution-date">Tanggal pembayaran *</Label><Input id="resolution-date" type="date" value={resolutionDate} onChange={handleResolutionDateChange} required /></div><div className="space-y-1"><Label htmlFor="resolution-amount">Nominal *</Label><FormattedNumberInput id="resolution-amount" min="1" step="0.01" value={resolutionAmount} onChange={handleResolutionAmountChange} required /></div><div className="space-y-1 sm:col-span-2"><Label htmlFor="payment-method">Metode pembayaran *</Label><select id="payment-method" value={paymentMethodCode} onChange={handlePaymentMethodChange} required disabled={paymentMethodsQuery.isLoading} className="min-h-11 w-full rounded-md border border-hairline bg-surface-2 px-3 text-sm text-ink"><option value="">{paymentMethodsQuery.isLoading ? 'Memuat metode...' : 'Pilih metode'}</option>{(paymentMethodsQuery.data?.data ?? []).map((method) => <option key={method.code} value={method.code}>{method.label}</option>)}</select>{paymentMethodsQuery.error && <p className="text-xs text-semantic-danger">Metode pembayaran belum dapat dimuat.</p>}</div></div>}
            {(reviewValidationError || resolveMutation.error) && <p role="alert" className="text-sm text-semantic-danger">{reviewValidationError ?? getErrorMessage(resolveMutation.error)}</p>}
            <DialogFooter className="gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={resolveMutation.isPending} onClick={handleCloseReview}>Batal</Button><Button type="submit" className="min-h-11" disabled={resolveMutation.isPending}>{resolveMutation.isPending ? <><Loader2 size={14} className="mr-1 animate-spin" />Menyimpan...</> : 'Simpan keputusan'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImagePreviewDialog
        open={Boolean(selectedProof)}
        onOpenChange={closeProof}
        src={selectedProof}
        alt="Bukti pembayaran sanggahan kas"
        title="Bukti sanggahan kas"
        description="Gunakan kontrol zoom untuk memeriksa bukti pembayaran."
        download={{
          onDownload: downloadProof,
          isLoading: downloadState === 'loading',
          hasError: downloadState === 'error',
        }}
      />
    </>
  );
}
