
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Loader2 } from 'lucide-react';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/api/errors';
import { isOneOf } from '@/shared/utils/isOneOf';

import { createAssignmentSchema, type CreateAssignmentFormValues } from '../schemas/gradeSchema';
import { ASSIGNMENT_CATEGORY_VALUES, ASSIGNMENT_CATEGORY_LABELS } from '../types/grades.types';

interface CreateAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateAssignmentFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function CreateAssignmentModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  error,
}: CreateAssignmentModalProps) {
  const form = useForm<CreateAssignmentFormValues>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: {
      title: '',
      category: 'class_task',
      description: '',
      kelas: 'X',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const selectedCategory = useWatch({
    control: form.control,
    name: 'category',
  });

  const selectedKelas = useWatch({
    control: form.control,
    name: 'kelas',
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    form.reset();
    onOpenChange(false);
  });

  const handleCategoryValueChange = (value: string | null) => {
    if (value === null) return;
    if (!isOneOf(value, ASSIGNMENT_CATEGORY_VALUES)) return;
    form.setValue('category', value);
  };

  const handleClassValueChange = (value: string | null) => {
    if (!value) return;
    form.setValue('kelas', value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <PlusCircle size={18} className="text-primary" />
            <DialogTitle className="text-ink text-base font-semibold">Buat Tugas / Kegiatan Penilaian</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            Buat judul tugas, projek crew film, atau event untuk penilaian masif.
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="space-y-4 pt-2">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs">
              {getErrorMessage(error)}
            </div>
          )}

          {/* Judul Tugas */}
          <div className="space-y-1">
            <Label htmlFor="title" className="text-ink-muted text-xs">Judul Tugas / Evaluasi *</Label>
            <Input
              id="title"
              placeholder="cth. Practical Test Lighting Studio / Produksi Film Pendek A"
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.title && 'border-semantic-danger')}
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Kategori */}
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Kategori *</Label>
              <Select
                value={selectedCategory}
                onValueChange={handleCategoryValueChange}
              >
                <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs">
                  <SelectValue placeholder="Pilih Kategori" />
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink">
                  <SelectItem value="class_task">{ASSIGNMENT_CATEGORY_LABELS.class_task}</SelectItem>
                  <SelectItem value="crew_film">{ASSIGNMENT_CATEGORY_LABELS.crew_film}</SelectItem>
                  <SelectItem value="event_participation">{ASSIGNMENT_CATEGORY_LABELS.event_participation}</SelectItem>
                  <SelectItem value="other">{ASSIGNMENT_CATEGORY_LABELS.other}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target Kelas */}
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Target Kelas</Label>
              <Select
                value={selectedKelas ?? 'X'}
                onValueChange={handleClassValueChange}
              >
                <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs">
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink">
                  <SelectItem value="X">Kelas X</SelectItem>
                  <SelectItem value="XI">Kelas XI</SelectItem>
                  <SelectItem value="XII">Kelas XII</SelectItem>
                  <SelectItem value="Semua">Semua Kelas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tanggal & Deskripsi */}
          <div className="space-y-1">
            <Label htmlFor="date" className="text-ink-muted text-xs">Tanggal Pelaksanaan *</Label>
            <Input
              id="date"
              type="date"
              className="bg-surface-2 border-hairline text-ink text-xs"
              {...form.register('date')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description" className="text-ink-muted text-xs">
              {selectedCategory === 'other' ? 'Keterangan Kategori Lainnya *' : 'Deskripsi Tugas (Opsional)'}
            </Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="Detail rubrik penilaian atau keterangan tugas..."
              className="bg-surface-2 border-hairline text-ink text-xs"
              {...form.register('description')}
            />
            {form.formState.errors.description && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.description.message}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-surface-2 border-hairline text-ink text-xs h-9">
              Batal
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs h-9 font-medium">
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Membuat...
                </>
              ) : (
                'Buat Tugas'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
