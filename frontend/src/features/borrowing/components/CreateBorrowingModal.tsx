import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PackagePlus, Loader2, Check, Search, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { SearchableCombobox } from '@/shared/ui/SearchableCombobox';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/api/errors';
import { formatNumber } from '@/shared/utils/formatNumber';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { useEquipmentChargesQuery } from '@/features/equipment/hooks/useEquipmentRecovery';

import { createBorrowingSchema, type CreateBorrowingFormValues } from '../schemas/borrowingSchema';

interface StudentOption {
  id: string;
  nama: string;
  kelas: string;
}

interface EquipmentOption {
  id: string;
  kode_alat: string;
  nama_alat: string;
  kategori: string;
  status: string;
  reservation_status?: 'tersedia' | 'dipesan';
}

interface CreateBorrowingModalProps {
  dialog: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
  options: {
    students: StudentOption[];
    studentsLoading?: boolean;
    studentsError?: unknown;
    equipmentList: EquipmentOption[];
    equipmentLoading?: boolean;
    equipmentError?: unknown;
  };
  submission: {
    onSubmit: (values: CreateBorrowingFormValues) => Promise<void>;
    isLoading?: boolean;
    error?: unknown;
  };
  actions: {
    onRetryStudents?: () => void;
    onRetryEquipment?: () => void;
  };
}

function getDefaultReturnDate(): string {
  const today = new Date();
  today.setDate(today.getDate() + 2);
  return today.toISOString().split('T')[0];
}

export function CreateBorrowingModal({
  dialog,
  options,
  submission,
  actions,
}: CreateBorrowingModalProps) {
  const { open, onOpenChange } = dialog;
  const {
    students,
    studentsLoading,
    studentsError,
    equipmentList,
    equipmentLoading,
    equipmentError,
  } = options;
  const { onSubmit, isLoading, error } = submission;
  const { onRetryStudents, onRetryEquipment } = actions;
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const searchableStudentOptions = useMemo(
    () => students.map((student) => ({
      id: student.id,
      label: student.nama,
      secondaryLabel: student.kelas,
    })),
    [students],
  );

  const availableEquipment = equipmentList
    .filter((e) => e.status === 'tersedia' && e.reservation_status !== 'dipesan')
    .filter((e) => {
      const search = equipmentSearch.trim().toLowerCase();
      return !search || `${e.kode_alat} ${e.nama_alat} ${e.kategori}`.toLowerCase().includes(search);
    });

  const form = useForm<CreateBorrowingFormValues>({
    resolver: zodResolver(createBorrowingSchema),
    defaultValues: {
      borrower_id: '',
      equipment_ids: [],
      tanggal_pinjam: new Date().toISOString().split('T')[0],
      rencana_kembali: getDefaultReturnDate(),
      keperluan: '',
    },
  });

  const selectedBorrowerId = useWatch({ control: form.control, name: 'borrower_id' });
  const selectedBorrowerOption = useMemo(
    () => searchableStudentOptions.find((student) => student.id === selectedBorrowerId) ?? null,
    [searchableStudentOptions, selectedBorrowerId],
  );
  const chargesQuery = useEquipmentChargesQuery(selectedBorrowerId, open);
  const outstandingCharge = (chargesQuery.data || []).reduce((total, charge) => total + Math.max(0, charge.amount - charge.paid_amount), 0);

  const handleBorrowerValueChange = (value: string | null) => {
    if (!value) return;
    form.setValue('borrower_id', value);
  };

  const toggleEquipmentSelect = (id: string) => {
    let nextIds: string[];
    if (selectedEquipmentIds.includes(id)) {
      nextIds = selectedEquipmentIds.filter((item) => item !== id);
    } else {
      nextIds = [...selectedEquipmentIds, id];
    }
    setSelectedEquipmentIds(nextIds);
    form.setValue('equipment_ids', nextIds, { shouldValidate: true });
  };

  const handleClose = () => {
    setSelectedEquipmentIds([]);
    setEquipmentSearch('');
    form.reset();
    onOpenChange(false);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    handleClose();
  });

  const equipmentContent = (() => {
    if (equipmentLoading) return <p className="text-center text-ink-tertiary text-xs py-4">Memuat alat yang tersedia...</p>;
    if (availableEquipment.length === 0) {
      return (
        <p className="text-center text-ink-tertiary text-xs py-4 italic">
          {equipmentError ? 'Daftar alat belum dapat dimuat. Gunakan tombol Coba lagi di atas.' : 'Tidak ada peralatan yang sedang tersedia untuk dipinjam saat ini.'}
        </p>
      );
    }
    return availableEquipment.map((eq) => {
      const isSelected = selectedEquipmentIds.includes(eq.id);
      return (
        <button
          type="button"
          aria-pressed={isSelected}
          key={eq.id}
          onClick={() => toggleEquipmentSelect(eq.id)}
          className={cn(
            'w-full text-left p-2 rounded border text-xs cursor-pointer flex items-center justify-between transition-colors',
            isSelected
              ? 'bg-primary/15 border-primary text-ink'
              : 'bg-surface-1 border-hairline text-ink-subtle hover:text-ink',
          )}
        >
          <div className="min-w-0 flex-1">
            <span className="font-mono font-bold text-primary text-[11px]">{eq.kode_alat}</span>
            <span className="ml-2">{eq.nama_alat}</span>
            <span className="ml-1 text-[10px] text-ink-tertiary">({eq.kategori})</span>
          </div>

          {isSelected && (
            <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <Check size={12} />
            </div>
          )}
        </button>
      );
    });
  })();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85dvh] max-w-xl overflow-hidden border-hairline bg-surface-1 text-ink">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <PackagePlus size={18} className="text-primary" />
            <DialogTitle className="text-ink text-base font-semibold">Buat Ajuan Peminjaman Alat</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            Pilih peminjam, pilih beberapa peralatan yang tersedia, dan tentukan rencana pengembalian.
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-hidden flex flex-col pt-1">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs shrink-0">
              {getErrorMessage(error)}
            </div>
          )}
          {Boolean(studentsError || equipmentError) && (
            <div role="alert" className="shrink-0 space-y-1 rounded border border-semantic-danger/30 bg-semantic-danger/10 px-3 py-2 text-xs text-semantic-danger">
              <p>Data peminjam atau alat belum berhasil dimuat.</p>
              {Boolean(studentsError) && <p className="text-[10px]">Peminjam: {getErrorMessage(studentsError)} <button type="button" className="ml-1 underline" onClick={onRetryStudents}>Coba lagi</button></p>}
              {Boolean(equipmentError) && <p className="text-[10px]">Alat: {getErrorMessage(equipmentError)} <button type="button" className="ml-1 underline" onClick={onRetryEquipment}>Coba lagi</button></p>}
            </div>
          )}
          {(studentsLoading || equipmentLoading) && !studentsError && !equipmentError && (
            <p className="shrink-0 rounded border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink-muted">Memuat data peminjam dan alat...</p>
          )}
          {selectedBorrowerId && chargesQuery.isError && <p role="alert" className="shrink-0 rounded border border-semantic-warning/30 bg-semantic-warning/10 px-3 py-2 text-xs text-semantic-warning">Status tagihan siswa belum dapat diperiksa. Coba lagi sebelum mengirim pengajuan.</p>}
          {selectedBorrowerId && !chargesQuery.isError && outstandingCharge > 0 && <p role="alert" className="shrink-0 rounded border border-semantic-warning/30 bg-semantic-warning/10 px-3 py-2 text-xs text-semantic-warning">Siswa ini masih memiliki tagihan alat {formatCurrency(outstandingCharge)}. Tagihan perlu dilunasi sebelum ajuan berikutnya disetujui.</p>}

          <div className="grid grid-cols-1 gap-3 shrink-0 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Pilih Peminjam (Siswa) *</Label>
              <SearchableCombobox
                options={searchableStudentOptions}
                value={selectedBorrowerId}
                selectedOption={selectedBorrowerOption}
                onValueChange={handleBorrowerValueChange}
                isLoading={Boolean(studentsLoading)}
                disabled={Boolean(studentsLoading || studentsError)}
                errorMessage={form.formState.errors.borrower_id?.message}
                ariaLabel="Cari dan pilih peminjam siswa"
                triggerLabel="Buka daftar peminjam"
                placeholder="Cari nama atau kelas..."
                emptyMessage="Siswa aktif tidak ditemukan."
                loadingMessage="Memuat daftar siswa..."
              />
              {form.formState.errors.borrower_id && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.borrower_id.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="keperluan" className="text-ink-muted text-xs">Keperluan Produksi *</Label>
              <Input
                id="keperluan"
                placeholder="cth. Shooting Short Movie A"
                className="bg-surface-2 border-hairline text-ink text-xs"
                {...form.register('keperluan')}
              />
              {form.formState.errors.keperluan && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.keperluan.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 shrink-0 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="tanggal_pinjam" className="text-ink-muted text-xs">Tanggal Pinjam *</Label>
              <Input
                id="tanggal_pinjam"
                type="date"
                className="bg-surface-2 border-hairline text-ink text-xs"
                {...form.register('tanggal_pinjam')}
              />
              {form.formState.errors.tanggal_pinjam && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.tanggal_pinjam.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="rencana_kembali" className="text-ink-muted text-xs">Rencana Pengembalian *</Label>
              <Input
                id="rencana_kembali"
                type="date"
                className="bg-surface-2 border-hairline text-ink text-xs"
                {...form.register('rencana_kembali')}
              />
              {form.formState.errors.rencana_kembali && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.rencana_kembali.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <Label className="text-ink-muted text-xs font-semibold">Pilih Peralatan Tersedia *</Label>
              <span className="text-[11px] text-primary font-medium">{formatNumber(selectedEquipmentIds.length)} alat dipilih</span>
            </div>

            <div className="relative shrink-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <Input
                value={equipmentSearch}
                onChange={(event) => setEquipmentSearch(event.target.value)}
                placeholder="Cari kode, nama, atau kategori alat..."
                className="pl-8 pr-8 bg-surface-2 border-hairline text-ink text-xs"
                aria-label="Cari peralatan tersedia"
              />
              {equipmentSearch && (
                <button
                  type="button"
                  onClick={() => setEquipmentSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink"
                  aria-label="Hapus pencarian alat"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto space-y-1.5 pr-1 border border-hairline rounded p-2 bg-surface-2/40">
              {equipmentContent}
            </div>
            {form.formState.errors.equipment_ids && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.equipment_ids.message}</p>
            )}
          </div>

          <DialogFooter className="shrink-0 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="bg-surface-2 border-hairline text-ink text-xs h-9">
              Batal
            </Button>
            <Button type="submit" disabled={isLoading || selectedEquipmentIds.length === 0} className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs h-9 font-medium">
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Mengirim Ajuan...
                </>
              ) : (
                'Kirim Ajuan Peminjaman'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
