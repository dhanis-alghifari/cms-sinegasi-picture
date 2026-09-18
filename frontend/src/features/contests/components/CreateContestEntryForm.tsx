import { FilePlus2, Loader2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { getErrorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { cn } from '@/shared/utils/cn';

import { useCreateContestEntryMutation } from '../hooks/useCreateContestEntryMutation';
import { createContestEntrySchema, type CreateContestEntryFormValues, workTypeEnum } from '../schemas/contestSchema';
import { DEFAULT_CONTEST_WORK_TYPE, type ContestWorkTypeOption } from '../types/contests.types';

interface CreateContestEntryFormProps {
  contestId: string;
  workTypeOptions: readonly ContestWorkTypeOption[];
  onClose: () => void;
}

export function CreateContestEntryForm({
  contestId,
  workTypeOptions,
  onClose,
}: CreateContestEntryFormProps) {
  const createContestEntryMutation = useCreateContestEntryMutation();
  const createEntryForm = useForm<CreateContestEntryFormValues>({
    resolver: zodResolver(createContestEntrySchema),
    defaultValues: { title: '', work_type_code: DEFAULT_CONTEST_WORK_TYPE },
  });
  const selectedWorkTypeCode = useWatch({
    control: createEntryForm.control,
    name: 'work_type_code',
  });
  const selectedWorkTypeLabel = workTypeOptions.find(
    (workType) => workType.code === selectedWorkTypeCode,
  )?.label ?? 'Pilih jenis karya';
  const formError = createContestEntryMutation.error
    ? getErrorMessage(createContestEntryMutation.error)
    : null;

  const handleCreateEntrySubmit = createEntryForm.handleSubmit(async (formValues) => {
    await createContestEntryMutation.mutateAsync({
      contestId,
      payload: { work: formValues },
    });
    createEntryForm.reset({ title: '', work_type_code: DEFAULT_CONTEST_WORK_TYPE });
    onClose();
  });

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleCreateEntrySubmit();
  };

  const handleWorkTypeValueChange = (value: string | null) => {
    if (value === null) return;
    const parsedWorkType = workTypeEnum.safeParse(value);
    if (!parsedWorkType.success) return;
    createEntryForm.setValue('work_type_code', parsedWorkType.data, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <form
      noValidate
      className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4"
      onSubmit={handleFormSubmit}
    >
      <div>
        <p className="text-sm font-semibold text-ink">Tambah karya</p>
        <p className="mt-0.5 text-xs text-ink-tertiary">
          Satu event dapat memiliki beberapa karya.
        </p>
      </div>

      {formError && (
        <div role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 px-3 py-2 text-xs text-semantic-danger">
          {formError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="work-title" className="text-xs text-ink-muted">Judul karya *</Label>
        <Input
          id="work-title"
          {...createEntryForm.register('title')}
          placeholder="Contoh: Jejak di Atas Kanvas"
          className={cn(
            'bg-surface-1 text-sm',
            createEntryForm.formState.errors.title && 'border-semantic-danger',
          )}
        />
        {createEntryForm.formState.errors.title && (
          <p className="text-[11px] text-semantic-danger">
            {createEntryForm.formState.errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-ink-muted">Jenis karya *</Label>
        <Select
          value={selectedWorkTypeCode}
          onValueChange={handleWorkTypeValueChange}
        >
          <SelectTrigger className="bg-surface-1 text-sm">
            <SelectValue>{selectedWorkTypeLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {workTypeOptions.map((workType) => (
              <SelectItem key={workType.code} value={workType.code}>
                {workType.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" size="sm" disabled={createContestEntryMutation.isPending}>
          {createContestEntryMutation.isPending
            ? <Loader2 size={14} className="animate-spin" />
            : <FilePlus2 size={14} />}
          Simpan karya
        </Button>
      </div>
    </form>
  );
}
