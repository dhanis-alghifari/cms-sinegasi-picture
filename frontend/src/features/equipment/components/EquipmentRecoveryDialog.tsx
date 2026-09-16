import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { ClipboardCheck, Loader2, Wrench } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Label } from '@/shared/ui/primitives/label';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { RadioGroup } from '@/shared/ui/primitives/radio-group';
import { getErrorMessage } from '@/shared/api/errors';
import { MultiImageUploadField } from './MultiImageUploadField';
import { FormattedNumberInput } from '@/shared/ui/FormattedNumberInput';
import type { Equipment, EquipmentRecoveryCase, RecoveryType } from '../types/equipment.types';

type RecoveryDialogMode = 'create' | 'repair' | 'replacement';

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
const nativeControlFocusClass = 'transition-[color,border-color,box-shadow] focus-visible:border-primary-focus focus-visible:ring-1 focus-visible:ring-primary-focus/50 focus-visible:ring-offset-0 focus-visible:outline-none';

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
  const [recoveryType, setRecoveryType] = useState<RecoveryType>(() => equipment?.kondisi === 'hilang' ? 'replacement' : 'repair');
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

  const close = () => { if (!isLoading) onOpenChange(false); };
  const handleRecoveryTypeChange = (value: string) => {
    if (value !== 'repair' && value !== 'replacement') return;
    setRecoveryType(value);
  };

  const handleConditionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextCondition = event.target.value;
    setCondition(nextCondition);
    if (nextCondition === 'lost') setRecoveryType('replacement');
  };

  const submit = async () => {
    setLocalError(null);
    try {
      if (changeReason.trim().length < 5) throw new Error('Alasan perubahan minimal 5 karakter.');
      if (mode === 'create') await onCreate({ recovery_type: recoveryType, reported_condition: condition, notes: notes.trim() || undefined, change_reason: changeReason.trim() });
      else if (mode === 'repair') {
        if (!recoveryCase) throw new Error('Tindak lanjut perbaikan tidak ditemukan.');
        if (photos.length < 2) throw new Error('Minimal 2 foto hasil pemeriksaan wajib diunggah.');
        if (!inspectionPassed) throw new Error('Konfirmasi checklist pemeriksaan akhir sebelum menyimpan.');
        await onCompleteRepair({ case_id: recoveryCase.id, inspection_photos: photos, inspection_passed: true, actual_cost: actualCost, notes: notes.trim() || undefined, change_reason: changeReason.trim() });
      } else {
        if (!recoveryCase) throw new Error('Tindak lanjut penggantian tidak ditemukan.');
        if (photos.length < 3) throw new Error('Minimal 3 foto alat pengganti wajib diunggah.');
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
            <RadioGroup name="recovery-type" legend="Jenis tindak lanjut *" value={recoveryType} options={condition === 'lost' ? [{ value: 'replacement', label: 'Ganti unit baru' }] : [{ value: 'repair', label: 'Perbaikan / servis' }, { value: 'replacement', label: 'Ganti unit baru' }]} onValueChange={handleRecoveryTypeChange} />
            <div className="space-y-1"><Label htmlFor="recovery-condition">Kondisi yang dilaporkan *</Label><select id="recovery-condition" value={condition} onChange={handleConditionChange} className={`h-9 w-full rounded-lg border border-input bg-surface-2 px-2.5 text-xs outline-none ${nativeControlFocusClass}`}>{conditionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="recovery-notes">Catatan</Label><Textarea id="recovery-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Jelaskan kerusakan atau alasan penggantian." /></div>
          </>}
          {mode === 'repair' && <>
            <MultiImageUploadField
              field={{ id: 'repair-photos', label: 'Foto hasil perbaikan', values: photos, onChange: setPhotos }}
              validation={{ minFiles: 2, required: true }}
              state={{ disabled: isLoading }}
            />
            <label htmlFor="repair-inspection-passed" className="flex cursor-pointer items-start gap-2 rounded-lg border border-hairline bg-surface-2/60 p-2.5 text-xs text-ink">
              <Checkbox id="repair-inspection-passed" checked={inspectionPassed} onChange={(event) => setInspectionPassed(event.currentTarget.checked)} disabled={isLoading} className="mt-0.5" />
              <span>Saya sudah memeriksa fungsi alat dan memastikan alat siap dipinjam kembali.</span>
            </label>
            <div className="space-y-1"><Label>Biaya aktual (opsional)</Label><FormattedNumberInput value={actualCost} onChange={setActualCost} placeholder="0" disabled={isLoading} /></div>
            <div className="space-y-1"><Label htmlFor="repair-notes">Catatan pemeriksaan</Label><Textarea id="repair-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Bagian yang diperbaiki dan hasil pengujian." /></div>
          </>}
          {mode === 'replacement' && <>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="replacement-code">Kode alat baru *</Label><Input id="replacement-code" value={equipmentCode} onChange={(event) => setEquipmentCode(event.target.value.toUpperCase())} placeholder="CAM-002" /></div><div className="space-y-1"><Label htmlFor="replacement-name">Nama alat baru *</Label><Input id="replacement-name" value={name} onChange={(event) => setName(event.target.value)} /></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="replacement-category">Kategori *</Label><select id="replacement-category" value={category} onChange={(event) => setCategory(event.target.value)} className={`h-9 w-full rounded-lg border border-input bg-surface-2 px-2.5 text-xs outline-none ${nativeControlFocusClass}`}>{categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="space-y-1"><Label>Nilai penggantian (opsional)</Label><FormattedNumberInput value={replacementValue} onChange={setReplacementValue} placeholder="-" disabled={isLoading} /></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="replacement-location">Lokasi penyimpanan</Label><Input id="replacement-location" value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} /></div><div className="space-y-1"><Label htmlFor="replacement-serial">Nomor seri</Label><Input id="replacement-serial" value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} /></div></div>
            <MultiImageUploadField
              field={{ id: 'replacement-photos', label: 'Foto alat pengganti', values: photos, onChange: setPhotos }}
              validation={{ minFiles: 3, required: true }}
              state={{ disabled: isLoading }}
            />
            <div className="space-y-1"><Label htmlFor="replacement-notes">Catatan</Label><Textarea id="replacement-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          </>}
          <div className="space-y-1 border-t border-hairline pt-3"><Label htmlFor="recovery-change-reason">Alasan perubahan (audit) *</Label><Input id="recovery-change-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Contoh: Verifikasi hasil servis alat" /></div>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={close} disabled={isLoading}>Batal</Button><Button type="button" onClick={() => void submit()} disabled={isLoading} className="bg-primary text-primary-foreground">{isLoading ? <><Loader2 size={14} className="mr-1.5 animate-spin" />Menyimpan...</> : <><ClipboardCheck size={14} className="mr-1.5" />Simpan</>}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
