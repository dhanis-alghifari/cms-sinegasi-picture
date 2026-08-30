import { useState } from 'react';
import { Check, Download, Eye, Loader2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { Pagination } from '@/shared/ui/Pagination';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';
import { getErrorMessage } from '@/shared/api/errors';
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
  const { data, isLoading, error } = useCashDisputesQuery({ page, pageSize: 10 }, true);
  const resolveMutation = useResolveDisputeMutation();
  const paymentMethodsQuery = useCashPaymentMethodsQuery(Boolean(reviewer));
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [evidenceLoadingId, setEvidenceLoadingId] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [downloadState, setDownloadState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [resolutionDate, setResolutionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [resolutionAmount, setResolutionAmount] = useState('');
  const [paymentMethodCode, setPaymentMethodCode] = useState('');
  const disputes = data?.data ?? [];

  if (isLoading) return <PageLoader />;
  if (error) return <div role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 p-4 text-sm text-semantic-danger">{getErrorMessage(error)}</div>;
  if (disputes.length === 0) return <EmptyState title="Belum ada sanggahan" description={reviewer ? 'Laporan sanggahan baru akan muncul di sini.' : 'Riwayat sanggahan Anda masih kosong.'} />;

  const closeProof = () => { setSelectedProof(null); setZoom(1); setDownloadState('idle'); };
  const openProof = async (dispute: CashDispute) => {
    setEvidenceLoadingId(dispute.id);
    setEvidenceError(null);
    try {
      const response = await cashService.getDisputeEvidence(dispute.id);
      const url = safeProofUrl(response.data.url);
      if (url) { setSelectedProof(url); setZoom(1); setDownloadState('idle'); }
    } catch (error) {
      setEvidenceError(getErrorMessage(error));
    } finally { setEvidenceLoadingId(null); }
  };
  const openReview = (dispute: CashDispute, status: 'approved' | 'rejected') => {
    setReviewDraft({ dispute, status });
    setReviewNote('');
    setResolutionDate(new Date().toISOString().slice(0, 10));
    setResolutionAmount(dispute.transaction_nominal ? String(dispute.transaction_nominal) : '');
    setPaymentMethodCode('');
  };
  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewDraft) return;
    await resolveMutation.mutateAsync({
      disputeId: reviewDraft.dispute.id,
      status: reviewDraft.status,
      review_note: reviewNote,
      resolution_date: reviewDraft.status === 'approved' && reviewDraft.dispute.debt_record_id ? resolutionDate : undefined,
      resolution_amount: reviewDraft.status === 'approved' && reviewDraft.dispute.debt_record_id ? Number(resolutionAmount) : undefined,
      payment_method_code: reviewDraft.status === 'approved' && reviewDraft.dispute.debt_record_id ? paymentMethodCode : undefined,
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
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{reviewer ? (dispute.student_nama ?? 'Siswa') : 'Laporan sanggahan kas'}</p><p className="mt-1 text-xs text-ink-tertiary">Dikirim {formatDateShort(dispute.created_at)}{dispute.transaction_tanggal ? ` · transaksi ${formatDateShort(dispute.transaction_tanggal)}` : ''} · attempt {dispute.attempt_number}</p></div>
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
      <Pagination page={data?.page ?? page} totalPages={data?.totalPages ?? 1} total={data?.total ?? disputes.length} pageSize={data?.pageSize ?? 10} onPageChange={setPage} />

      <Dialog open={Boolean(reviewDraft)} onOpenChange={(open) => { if (!open && !resolveMutation.isPending) setReviewDraft(null); }}>
        <DialogContent className="max-w-lg border-hairline bg-surface-1 text-ink">
          <DialogHeader><DialogTitle>{reviewDraft?.status === 'approved' ? 'Setujui sanggahan' : 'Tolak sanggahan'}</DialogTitle><DialogDescription className="text-ink-subtle">Catatan pemeriksa wajib diisi dan tersimpan dalam riwayat audit.</DialogDescription></DialogHeader>
          <form onSubmit={(event) => void submitReview(event)} className="space-y-4">
            <div className="space-y-1"><Label htmlFor="review-note">Catatan pemeriksaan *</Label><Textarea id="review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} minLength={5} maxLength={2000} required rows={4} placeholder="Jelaskan hasil pemeriksaan bukti..." /></div>
            {reviewDraft?.status === 'approved' && reviewDraft.dispute.debt_record_id && <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="resolution-date">Tanggal pembayaran *</Label><Input id="resolution-date" type="date" value={resolutionDate} onChange={(event) => setResolutionDate(event.target.value)} required /></div><div className="space-y-1"><Label htmlFor="resolution-amount">Nominal *</Label><Input id="resolution-amount" type="number" min={1} value={resolutionAmount} onChange={(event) => setResolutionAmount(event.target.value)} required /></div><div className="space-y-1 sm:col-span-2"><Label htmlFor="payment-method">Metode pembayaran *</Label><select id="payment-method" value={paymentMethodCode} onChange={(event) => setPaymentMethodCode(event.target.value)} required disabled={paymentMethodsQuery.isLoading} className="min-h-11 w-full rounded-md border border-hairline bg-surface-2 px-3 text-sm text-ink"><option value="">{paymentMethodsQuery.isLoading ? 'Memuat metode...' : 'Pilih metode'}</option>{(paymentMethodsQuery.data?.data ?? []).map((method) => <option key={method.code} value={method.code}>{method.label}</option>)}</select>{paymentMethodsQuery.error && <p className="text-xs text-semantic-danger">Metode pembayaran belum dapat dimuat.</p>}</div></div>}
            {resolveMutation.error && <p role="alert" className="text-sm text-semantic-danger">{getErrorMessage(resolveMutation.error)}</p>}
            <DialogFooter className="gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={resolveMutation.isPending} onClick={() => setReviewDraft(null)}>Batal</Button><Button type="submit" className="min-h-11" disabled={resolveMutation.isPending}>{resolveMutation.isPending ? <><Loader2 size={14} className="mr-1 animate-spin" />Menyimpan...</> : 'Simpan keputusan'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedProof)} onOpenChange={(open) => { if (!open) closeProof(); }}>
        <DialogContent className="max-w-4xl gap-3 border-hairline bg-surface-1 p-4 text-ink sm:p-5">
          <DialogHeader className="pr-8"><DialogTitle className="text-ink">Bukti sanggahan kas</DialogTitle><DialogDescription className="text-ink-subtle">Gunakan kontrol zoom untuk memeriksa bukti pembayaran.</DialogDescription></DialogHeader>
          <div className="flex h-[min(58dvh,32rem)] min-h-48 items-center justify-center overflow-auto rounded-lg border border-hairline bg-surface-2 p-3">{selectedProof && <img src={selectedProof} alt="Bukti pembayaran sanggahan kas" referrerPolicy="no-referrer" className="max-h-full max-w-full select-none object-contain transition-transform duration-150" style={{ transform: `scale(${zoom})` }} draggable={false} />}</div>
          <div className="flex flex-wrap items-center justify-center gap-2" aria-label="Kontrol bukti sanggahan"><Button type="button" size="icon-sm" variant="outline" aria-label="Perkecil bukti" disabled={zoom <= 0.75} onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.25).toFixed(2))))}><ZoomOut size={15} /></Button><span className="min-w-14 text-center text-xs font-medium text-ink-subtle" aria-live="polite">{Math.round(zoom * 100)}%</span><Button type="button" size="icon-sm" variant="outline" aria-label="Perbesar bukti" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}><ZoomIn size={15} /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label="Reset zoom" disabled={zoom === 1} onClick={() => setZoom(1)}><RotateCcw size={15} /></Button></div>
          {downloadState === 'error' && <p role="alert" className="text-center text-xs text-semantic-danger">Download langsung tidak tersedia. Simpan gambar melalui browser.</p>}
          <DialogFooter className="gap-2 border-t border-hairline bg-transparent pt-3 sm:flex-row sm:items-center sm:justify-end"><Button type="button" className="min-h-11 w-full sm:w-auto" disabled={downloadState === 'loading'} onClick={() => void downloadProof()}><Download size={14} className="mr-1" />{downloadState === 'loading' ? 'Menyiapkan...' : 'Download'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
