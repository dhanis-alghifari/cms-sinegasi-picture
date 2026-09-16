
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

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
import { Textarea } from '@/shared/ui/primitives/textarea';
import { RadioGroup } from '@/shared/ui/primitives/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/api/errors';
import { MultiImageUploadField } from './MultiImageUploadField';

import { equipmentSchema, type EquipmentFormValues } from '../schemas/equipmentSchema';
import type {
  Equipment,
} from '../types/equipment.types';
import {
  EQUIPMENT_AVAILABILITY_VALUES,
  EQUIPMENT_CATEGORY_VALUES,
  EQUIPMENT_CONDITION_VALUES,
} from '../types/equipment.types';
import { isOneOf } from '@/shared/utils/isOneOf';

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: Equipment | null;
  onSubmit: (values: EquipmentFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

function getEquipmentPhotoUrls(equipment: Equipment): string[] {
  if (equipment.foto_urls?.length) return equipment.foto_urls;
  if (equipment.foto_url) return [equipment.foto_url];
  return [];
}

export function EquipmentFormDialog({
  open,
  onOpenChange,
  equipment,
  onSubmit,
  isLoading,
  error,
}: EquipmentFormDialogProps) {
  const isEditing = Boolean(equipment);

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      kode_alat: '',
      nama_alat: '',
      kategori: 'Kamera',
      kondisi: 'bagus',
      status: 'tersedia',
      lokasi_penyimpanan: 'Gudang Sinematografi',
      serial_number: '',
      foto_urls: [],
      deskripsi: '',
      change_reason: '',
    },
  });

  const selectedCategory = useWatch({ control: form.control, name: 'kategori' });
  const selectedCondition = useWatch({ control: form.control, name: 'kondisi' });
  const selectedStatus = useWatch({ control: form.control, name: 'status' });
  const watchedFotoUrls = useWatch({ control: form.control, name: 'foto_urls' });

  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (equipment) {
      form.reset({
        kode_alat: equipment.kode_alat,
        nama_alat: equipment.nama_alat,
        kategori: equipment.kategori,
        kondisi: equipment.kondisi,
        status: equipment.status,
        lokasi_penyimpanan: equipment.lokasi_penyimpanan ?? '',
        serial_number: equipment.serial_number ?? '',
        foto_urls: getEquipmentPhotoUrls(equipment),
        deskripsi: equipment.deskripsi ?? '',
        change_reason: '',
      });
    } else {
      form.reset({
        kode_alat: '',
        nama_alat: '',
        kategori: 'Kamera',
        kondisi: 'bagus',
        status: 'tersedia',
        lokasi_penyimpanan: 'Gudang Sinematografi',
        serial_number: '',
        foto_urls: [],
        deskripsi: '',
        change_reason: '',
      });
    }
  }, [equipment, form, open]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setFormError(null);
    onOpenChange(nextOpen);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    setFormError(null);
    if (isEditing && (!data.change_reason || data.change_reason.trim().length < 5)) {
      setFormError('Alasan perubahan wajib diisi (minimal 5 karakter)');
      return;
    }
    try {
      await onSubmit(data);
      handleDialogOpenChange(false);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  });

  const handleCategoryValueChange = (value: string | null) => {
    if (value === null) return;
    if (!isOneOf(value, EQUIPMENT_CATEGORY_VALUES)) return;
    form.setValue('kategori', value);
  };

  const handleConditionValueChange = (value: string | null) => {
    if (value === null) return;
    if (!isOneOf(value, EQUIPMENT_CONDITION_VALUES)) return;
    form.setValue('kondisi', value);
  };

  const handleAvailabilityValueChange = (value: string | null) => {
    if (value === null) return;
    if (!isOneOf(value, EQUIPMENT_AVAILABILITY_VALUES)) return;
    form.setValue('status', value);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-ink text-base font-semibold">
            {isEditing ? 'Edit Data Alat' : 'Tambah Alat Sinematografi Baru'}
          </DialogTitle>
          <DialogDescription className="text-ink-subtle text-xs">
            {isEditing
              ? 'Ubah spesifikasi, lokasi, atau foto kondisi peralatan.'
              : 'Isi formulir dan unggah minimal 3 foto dari sudut berbeda untuk mendaftarkan alat.'}
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="space-y-4 pt-2">
          {(formError || Boolean(error)) && (
            <div role="alert" className="px-3.5 py-2.5 rounded-md bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs font-medium">
              {formError || getErrorMessage(error)}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="kode_alat" className="text-ink-muted text-xs">Kode Alat (QR/Barcode) *</Label>
              <Input
                id="kode_alat"
                placeholder="cth. CAM-001"
                className={cn('bg-surface-2 border-hairline text-ink text-xs font-mono uppercase', form.formState.errors.kode_alat && 'border-semantic-danger')}
                {...form.register('kode_alat')}
              />
              {form.formState.errors.kode_alat && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.kode_alat.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Kategori *</Label>
              <Select
                value={selectedCategory}
                onValueChange={handleCategoryValueChange}
              >
                <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs">
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink">
                  <SelectItem value="Kamera">Kamera</SelectItem>
                  <SelectItem value="Lensa">Lensa</SelectItem>
                  <SelectItem value="Audio">Audio</SelectItem>
                  <SelectItem value="Lighting">Lighting</SelectItem>
                  <SelectItem value="Aksesoris">Aksesoris</SelectItem>
                  <SelectItem value="Lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="nama_alat" className="text-ink-muted text-xs">Nama Peralatan *</Label>
            <Input
              id="nama_alat"
              placeholder="cth. Sony FX3 Cinema Line / Aputure 300d II"
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.nama_alat && 'border-semantic-danger')}
              {...form.register('nama_alat')}
            />
            {form.formState.errors.nama_alat && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.nama_alat.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Kondisi Fisik *</Label>
              <Select
                value={selectedCondition}
                onValueChange={handleConditionValueChange}
              >
                <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs">
                  <SelectValue placeholder="Pilih kondisi" />
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink">
                  <SelectItem value="bagus">Bagus</SelectItem>
                  <SelectItem value="sedikit_kerusakan">Sedikit Rusak</SelectItem>
                  <SelectItem value="rusak">Rusak</SelectItem>
                  <SelectItem value="rusak_besar">Rusak Besar</SelectItem>
                  <SelectItem value="sedang_diperbaiki">Sedang Diperbaiki</SelectItem>
                  <SelectItem value="hilang">Hilang</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <RadioGroup
              name="equipment-availability"
              legend="Status Ketersediaan *"
              value={selectedStatus ?? ''}
              options={[
                { value: 'tersedia', label: 'Tersedia' },
                { value: 'dipinjam', label: 'Dipinjam' },
                { value: 'maintenance', label: 'Maintenance' },
              ]}
              onValueChange={handleAvailabilityValueChange}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="lokasi_penyimpanan" className="text-ink-muted text-xs">Lokasi Rak / Penyimpanan</Label>
              <Input
                id="lokasi_penyimpanan"
                placeholder="cth. Rak A-02 Studio 1"
              className="bg-surface-2 border-hairline text-ink text-xs"
                {...form.register('lokasi_penyimpanan')}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="serial_number" className="text-ink-muted text-xs">Serial Number (SN)</Label>
              <Input
                id="serial_number"
                placeholder="cth. SN-8839201"
              className="bg-surface-2 border-hairline text-ink text-xs font-mono"
                {...form.register('serial_number')}
              />
            </div>
          </div>

          <MultiImageUploadField
            field={{
              id: 'foto_urls',
              label: 'Foto Kondisi Alat (Minimal 3 Sudut)',
              values: watchedFotoUrls,
              onChange: (values) => form.setValue('foto_urls', values, { shouldValidate: true, shouldDirty: true }),
            }}
            validation={{ required: true, error: form.formState.errors.foto_urls?.message }}
            state={{ disabled: isLoading, onProcessingChange: setIsImageProcessing }}
          />

          <div className="space-y-1">
            <Label htmlFor="deskripsi" className="text-ink-muted text-xs">Kelengkapan / Deskripsi</Label>
            <Textarea
              id="deskripsi"
              rows={2}
              placeholder="Kelengkapan: Dus, Baterai 2x, Charger, Lens Cap..."
              className="bg-surface-2 border-hairline text-ink text-xs"
              {...form.register('deskripsi')}
            />
          </div>

          {isEditing && (
            <div className="space-y-1 pt-2 border-t border-hairline">
              <Label htmlFor="change_reason" className="text-ink-muted text-xs font-semibold">
                Alasan Perubahan (Audit Header) *
              </Label>
              <Input
                id="change_reason"
                placeholder="cth. Perubahan spesifikasi / update lokasi rak penyimpanan"
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.change_reason && 'border-semantic-danger')}
                {...form.register('change_reason')}
              />
              {form.formState.errors.change_reason && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.change_reason.message}</p>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)} className="bg-surface-2 border-hairline text-ink text-xs h-9">
              Batal
            </Button>
            <Button type="submit" disabled={isLoading || isImageProcessing} className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs h-9 font-medium">
              {isLoading || isImageProcessing ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Alat'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
