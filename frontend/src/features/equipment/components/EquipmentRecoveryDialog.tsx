import { useState } from 'react';
import { ClipboardCheck, Loader2, Wrench } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { FieldError } from '@/shared/ui/FieldError';
import { Input } from '@/shared/ui/primitives/input';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Label } from '@/shared/ui/primitives/label';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { RadioGroup } from '@/shared/ui/primitives/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { getErrorMessage } from '@/shared/api/errors';
import { cn } from '@/shared/utils/cn';
import { MultiImageUploadField } from './MultiImageUploadField';
import { FormattedNumberInput } from '@/shared/ui/FormattedNumberInput';
import type { Equipment, EquipmentRecoveryCase, RecoveryType } from '../types/equipment.types';

type RecoveryDialogMode = 'create' | 'repair' | 'replacement';
type RecoveryField = 'changeReason' | 'photos' | 'inspection' | 'equipmentCode' | 'name' | 'recoveryType';
type RecoveryFieldErrors = Partial<Record<RecoveryField, string>>;

interface EquipmentRecoveryDialogProps {
  dialog: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
  context: {
    mode: RecoveryDialogMode;
    equipment?: Equipment | null;
    recoveryCase?: EquipmentRecoveryCase | null;
  };
  submission: {
    isLoading?: boolean;
    error?: unknown;
    onCreate: (payload: { recovery_type: RecoveryType; reported_condition: string; notes?: string; change_reason: string }) => Promise<void>;
    onCompleteRepair: (payload: { case_id: string; inspection_photos: string[]; inspection_passed: boolean; actual_cost?: number; notes?: string; change_reason: string }) => Promise<void>;
    onRegisterReplacement: (payload: { case_id: string; equipment_code: string; name: string; category: string; storage_location?: string; serial_number?: string; photo_urls: string[]; description?: string; replacement_value?: number; change_reason: string }) => Promise<void>;
  };
}

const conditionOptions = [
  { value: 'minor_damage', label: 'Sedikit rusak' }, { value: 'damaged', label: 'Rusak' },
  { value: 'severely_damaged', label: 'Rusak berat' }, { value: 'under_repair', label: 'Sedang diperbaiki' }, { value: 'lost', label: 'Hilang' },
];
const categoryOptions = [
  { value: 'camera', label: 'Kamera' }, { value: 'lens', label: 'Lensa' }, { value: 'audio', label: 'Audio' },
  { value: 'lighting', label: 'Lighting' }, { value: 'accessory', label: 'Aksesoris' }, { value: 'other', label: 'Lainnya' },
];
const categoryCodeByLabel: Record<string, string> = { Kamera: 'camera', Lensa: 'lens', Audio: 'audio', Lighting: 'lighting', Aksesoris: 'accessory', Lainnya: 'other' };
const conditionCodeByLabel: Record<string, string> = { sedikit_kerusakan: 'minor_damage', rusak: 'damaged', rusak_besar: 'severely_damaged', sedang_diperbaiki: 'under_repair', hilang: 'lost' };
function getRecoveryDialogTitle(mode: RecoveryDialogMode): string {
  switch (mode) {
    case 'create':
      return 'Buka tindak lanjut alat';
    case 'repair':
      return 'Konfirmasi alat selesai diperbaiki';
    default:
      return 'Daftarkan alat pengganti';
  }
}

export function EquipmentRecoveryDialog({
  dialog,
  context,
  submission,
}: EquipmentRecoveryDialogProps) {
  const { open, onOpenChange } = dialog;
  const { mode, equipment, recoveryCase } = context;
  const {
    isLoading,
    error,
    onCreate,
    onCompleteRepair,
    onRegisterReplacement,
  } = submission;
  const [recoveryType, setRecoveryType] = useState<RecoveryType | null>(() => equipment?.kondisi === 'hilang' ? 'replacement' : null);
  const [condition, setCondition] = useState(() => conditionCodeByLabel[equipment?.kondisi || ''] || 'damaged');
  const [notes, setNotes] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [inspectionPassed, setInspectionPassed] = useState(false);
  const [actualCost, setActualCost] = useState<number | undefined>();
  const [equipmentCode, setEquipmentCode] = useState('');
  const [name, setName] = useState(() => equipment?.nama_alat ? `${equipment.nama_alat} (Pengganti)` : '');
  const [category, setCategory] = useState(() => categoryCodeByLabel[equipment?.kategori || ''] || 'other');
  const [storageLocation, setStorageLocation] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [replacementValue, setReplacementValue] = useState<number | undefined>();
  const [localError, setLocalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RecoveryFieldErrors>({});

  const clearFieldError = (field: RecoveryField) => {
    setFieldErrors((existingErrors) => {
      if (!existingErrors[field]) return existingErrors;
      const nextErrors = { ...existingErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };
  const close = () => {
    if (isLoading) return;
    setLocalError(null);
    setFieldErrors({});
    onOpenChange(false);
  };
  const handleRecoveryTypeChange = (value: string) => {
    if (value !== 'repair' && value !== 'replacement') return;
    setRecoveryType(value);
    clearFieldError('recoveryType');
  };

  const handleConditionChange = (nextCondition: string | null) => {
    if (!nextCondition) return;
    setCondition(nextCondition);
    if (nextCondition === 'lost') {
      setRecoveryType('replacement');
      clearFieldError('recoveryType');
    }
  };

  const handleCategoryChange = (nextCategory: string | null) => {
    if (nextCategory) setCategory(nextCategory);
  };

  const submit = async () => {
    setLocalError(null);
    setFieldErrors({});
    const validationErrors: RecoveryFieldErrors = {};
    if (mode === 'create' && !recoveryType) {
      validationErrors.recoveryType = 'Pilih jenis tindak lanjut sebelum menyimpan.';
    }
    if (changeReason.trim().length < 5) validationErrors.changeReason = 'Alasan perubahan minimal 5 karakter.';
    if (mode === 'repair' && photos.length < 2) {
      validationErrors.photos = 'Minimal 2 foto hasil pemeriksaan wajib diunggah.';
    }
    if (mode === 'repair' && !inspectionPassed) {
      validationErrors.inspection = 'Konfirmasi checklist pemeriksaan akhir sebelum menyimpan.';
    }
    if (mode === 'replacement' && !equipmentCode.trim()) {
      validationErrors.equipmentCode = 'Kode alat baru wajib diisi.';
    }
    if (mode === 'replacement' && !name.trim()) {
      validationErrors.name = 'Nama alat baru wajib diisi.';
    }
    if (mode === 'replacement' && photos.length < 3) {
      validationErrors.photos = 'Minimal 3 foto alat pengganti wajib diunggah.';
    }
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }
    try {
      if (mode === 'create') {
        if (!recoveryType) return;
        await onCreate({ recovery_type: recoveryType, reported_condition: condition, notes: notes.trim() || undefined, change_reason: changeReason.trim() });
      }
      else if (mode === 'repair') {
        if (!recoveryCase) throw new Error('Tindak lanjut perbaikan tidak ditemukan.');
        await onCompleteRepair({ case_id: recoveryCase.id, inspection_photos: photos, inspection_passed: true, actual_cost: actualCost, notes: notes.trim() || undefined, change_reason: changeReason.trim() });
      } else {
        if (!recoveryCase) throw new Error('Tindak lanjut penggantian tidak ditemukan.');
        await onRegisterReplacement({ case_id: recoveryCase.id, equipment_code: equipmentCode.trim(), name: name.trim(), category, storage_location: storageLocation.trim() || undefined, serial_number: serialNumber.trim() || undefined, photo_urls: photos, description: notes.trim() || undefined, replacement_value: replacementValue, change_reason: changeReason.trim() });
      }
      onOpenChange(false);
    } catch (submitError) { setLocalError(getErrorMessage(submitError)); }
  };

  const title = getRecoveryDialogTitle(mode);
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-hidden border-hairline bg-surface-1 text-ink">
        <DialogHeader>
          <div className="flex items-center gap-2"><Wrench size={18} className="text-semantic-warning" /><DialogTitle className="text-base">{title}</DialogTitle></div>
          <DialogDescription className="text-xs text-ink-subtle">{equipment ? `${equipment.kode_alat} - ${equipment.nama_alat}` : 'Catat langkah pemulihan agar alat dapat dipinjam kembali.'}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {Boolean(localError || error) && <div role="alert" className="rounded border border-semantic-danger/30 bg-semantic-danger/10 px-3 py-2 text-xs text-semantic-danger">{localError || (error ? getErrorMessage(error) : null)}</div>}
          {mode === 'create' && <>
            <div className="space-y-1">
              <RadioGroup name="recovery-type" legend="Jenis tindak lanjut *" value={recoveryType} options={condition === 'lost' ? [{ value: 'replacement', label: 'Ganti unit baru' }] : [{ value: 'repair', label: 'Perbaikan / servis' }, { value: 'replacement', label: 'Ganti unit baru' }]} onValueChange={handleRecoveryTypeChange} />
              <FieldError id="recovery-type-error" message={fieldErrors.recoveryType} />
            </div>
            <div className="space-y-1"><Label htmlFor="recovery-condition">Kondisi yang dilaporkan *</Label><Select value={condition} onValueChange={handleConditionChange} required><SelectTrigger id="recovery-condition" className="bg-surface-2 text-xs"><SelectValue placeholder="Pilih kondisi" /></SelectTrigger><SelectContent>{conditionOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label htmlFor="recovery-notes">Catatan</Label><Textarea id="recovery-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Jelaskan kerusakan atau alasan penggantian." /></div>
          </>}
          {mode === 'repair' && <>
            <MultiImageUploadField
              field={{ id: 'repair-photos', label: 'Foto hasil perbaikan', values: photos, onChange: (nextPhotos) => { setPhotos(nextPhotos); clearFieldError('photos'); } }}
              validation={{ minFiles: 2, required: true, error: fieldErrors.photos }}
              state={{ disabled: isLoading }}
            />
            <div className="space-y-1">
              <label htmlFor="repair-inspection-passed" className={cn('flex cursor-pointer items-start gap-2 rounded-lg border bg-surface-2/60 p-2.5 text-xs text-ink', fieldErrors.inspection ? 'border-semantic-danger' : 'border-hairline')}>
                <Checkbox id="repair-inspection-passed" checked={inspectionPassed} onChange={(event) => { setInspectionPassed(event.currentTarget.checked); clearFieldError('inspection'); }} disabled={isLoading} className="mt-0.5" aria-invalid={Boolean(fieldErrors.inspection)} aria-describedby={fieldErrors.inspection ? 'repair-inspection-error' : undefined} />
                <span>Saya sudah memeriksa fungsi alat dan memastikan alat siap dipinjam kembali.</span>
              </label>
              <FieldError id="repair-inspection-error" message={fieldErrors.inspection} />
            </div>
            <div className="space-y-1"><Label>Biaya aktual (opsional)</Label><FormattedNumberInput value={actualCost} onChange={setActualCost} placeholder="0" disabled={isLoading} /></div>
            <div className="space-y-1"><Label htmlFor="repair-notes">Catatan pemeriksaan</Label><Textarea id="repair-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Bagian yang diperbaiki dan hasil pengujian." /></div>
          </>}
          {mode === 'replacement' && <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="replacement-code">Kode alat baru *</Label>
                <Input id="replacement-code" value={equipmentCode} onChange={(event) => { setEquipmentCode(event.target.value.toUpperCase()); clearFieldError('equipmentCode'); }} placeholder="CAM-002" aria-invalid={Boolean(fieldErrors.equipmentCode)} aria-describedby={fieldErrors.equipmentCode ? 'replacement-code-error' : undefined} className={fieldErrors.equipmentCode ? 'border-semantic-danger' : undefined} />
                <FieldError id="replacement-code-error" message={fieldErrors.equipmentCode} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="replacement-name">Nama alat baru *</Label>
                <Input id="replacement-name" value={name} onChange={(event) => { setName(event.target.value); clearFieldError('name'); }} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'replacement-name-error' : undefined} className={fieldErrors.name ? 'border-semantic-danger' : undefined} />
                <FieldError id="replacement-name-error" message={fieldErrors.name} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="replacement-category">Kategori *</Label><Select value={category} onValueChange={handleCategoryChange} required><SelectTrigger id="replacement-category" className="bg-surface-2 text-xs"><SelectValue placeholder="Pilih kategori" /></SelectTrigger><SelectContent>{categoryOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Nilai penggantian (opsional)</Label><FormattedNumberInput value={replacementValue} onChange={setReplacementValue} placeholder="-" disabled={isLoading} /></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="replacement-location">Lokasi penyimpanan</Label><Input id="replacement-location" value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} /></div><div className="space-y-1"><Label htmlFor="replacement-serial">Nomor seri</Label><Input id="replacement-serial" value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} /></div></div>
            <MultiImageUploadField
              field={{ id: 'replacement-photos', label: 'Foto alat pengganti', values: photos, onChange: (nextPhotos) => { setPhotos(nextPhotos); clearFieldError('photos'); } }}
              validation={{ minFiles: 3, required: true, error: fieldErrors.photos }}
              state={{ disabled: isLoading }}
            />
            <div className="space-y-1"><Label htmlFor="replacement-notes">Catatan</Label><Textarea id="replacement-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          </>}
          <div className="space-y-1 border-t border-hairline pt-3">
            <Label htmlFor="recovery-change-reason">Alasan perubahan (audit) *</Label>
            <Input id="recovery-change-reason" value={changeReason} onChange={(event) => { setChangeReason(event.target.value); clearFieldError('changeReason'); }} placeholder="Contoh: Verifikasi hasil servis alat" aria-invalid={Boolean(fieldErrors.changeReason)} aria-describedby={fieldErrors.changeReason ? 'recovery-change-reason-error' : undefined} className={fieldErrors.changeReason ? 'border-semantic-danger' : undefined} />
            <FieldError id="recovery-change-reason-error" message={fieldErrors.changeReason} />
          </div>
        </div>
        <DialogFooter><Button type="button" variant="secondary" onClick={close} disabled={isLoading}>Batal</Button><Button type="button" onClick={() => void submit()} disabled={isLoading} className="bg-primary text-primary-foreground">{isLoading ? <><Loader2 size={14} className="mr-1.5 animate-spin" />Menyimpan...</> : <><ClipboardCheck size={14} className="mr-1.5" />Simpan</>}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
