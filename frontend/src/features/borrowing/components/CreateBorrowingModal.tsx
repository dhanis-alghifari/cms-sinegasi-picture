// src/features/borrowing/components/CreateBorrowingModal.tsx
// Modal for submitting equipment borrowing request
// Multi-item selection from available equipment catalog with mandatory change_reason audit field

import { useState } from 'react';
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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/shared/api/errors';
import { formatNumber } from '@/shared/utils/formatNumber';

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: StudentOption[];
  equipmentList: EquipmentOption[];
  onSubmit: (values: CreateBorrowingFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

function getDefaultReturnDate(): string {
  const today = new Date();
  today.setDate(today.getDate() + 2);
  return today.toISOString().split('T')[0];
}

export function CreateBorrowingModal({
  open,
  onOpenChange,
  students,
  equipmentList,
  onSubmit,
  isLoading,
  error,
}: CreateBorrowingModalProps) {
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [equipmentSearch, setEquipmentSearch] = useState('');

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
  const selectedBorrower = students.find((student) => student.id === selectedBorrowerId);

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

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-hidden flex flex-col pt-1">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs shrink-0">
              {getErrorMessage(error)}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 shrink-0 sm:grid-cols-2">
            {/* Peminjam */}
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Pilih Peminjam (Siswa) *</Label>
              <Select
                value={selectedBorrowerId}
                onValueChange={(val) => val && form.setValue('borrower_id', val)}
              >
                <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs h-9">
                  <SelectValue placeholder="Pilih Siswa">
                    {selectedBorrower ? `${selectedBorrower.nama} (${selectedBorrower.kelas})` : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink">
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nama} ({s.kelas})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.borrower_id && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.borrower_id.message}</p>
              )}
            </div>

            {/* Keperluan */}
            <div className="space-y-1">
              <Label htmlFor="keperluan" className="text-ink-muted text-xs">Keperluan Produksi *</Label>
              <Input
                id="keperluan"
                placeholder="cth. Shooting Short Movie A"
                className="bg-surface-2 border-hairline text-ink text-xs h-9"
                {...form.register('keperluan')}
              />
              {form.formState.errors.keperluan && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.keperluan.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 shrink-0 sm:grid-cols-2">
            {/* Tanggal Pinjam */}
            <div className="space-y-1">
              <Label htmlFor="tanggal_pinjam" className="text-ink-muted text-xs">Tanggal Pinjam *</Label>
              <Input
                id="tanggal_pinjam"
                type="date"
                className="bg-surface-2 border-hairline text-ink text-xs h-9"
                {...form.register('tanggal_pinjam')}
              />
              {form.formState.errors.tanggal_pinjam && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.tanggal_pinjam.message}</p>
              )}
            </div>

            {/* Rencana Kembali */}
            <div className="space-y-1">
              <Label htmlFor="rencana_kembali" className="text-ink-muted text-xs">Rencana Pengembalian *</Label>
              <Input
                id="rencana_kembali"
                type="date"
                className="bg-surface-2 border-hairline text-ink text-xs h-9"
                {...form.register('rencana_kembali')}
              />
              {form.formState.errors.rencana_kembali && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.rencana_kembali.message}</p>
              )}
            </div>
          </div>

          {/* Equipment Multi-Selector List */}
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
                className="pl-8 pr-8 bg-surface-2 border-hairline text-ink text-xs h-8"
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
              {availableEquipment.length === 0 ? (
                <p className="text-center text-ink-tertiary text-xs py-4 italic">
                  Tidak ada peralatan yang sedang tersedia untuk dipinjam saat ini.
                </p>
              ) : (
                availableEquipment.map((eq) => {
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
                })
              )}
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
