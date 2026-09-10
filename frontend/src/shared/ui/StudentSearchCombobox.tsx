import { Combobox } from '@base-ui/react/combobox';
import { Check, ChevronDown, Search } from 'lucide-react';

import { cn } from '@/shared/utils/cn';

export type SearchableStudentOption = {
  id: string;
  label: string;
  secondaryLabel: string;
};

interface StudentSearchComboboxProps<T extends SearchableStudentOption> {
  options: T[];
  value?: string;
  selectedOption?: T | null;
  onValueChange: (value: string) => void;
  onSelectedOptionChange?: (option: T | null) => void;
  onSearchChange: (value: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  errorMessage?: string;
}

export function StudentSearchCombobox<T extends SearchableStudentOption>({
  options,
  value,
  selectedOption: selectedOptionProp,
  onValueChange,
  onSelectedOptionChange,
  onSearchChange,
  isLoading = false,
  disabled = false,
  errorMessage,
}: StudentSearchComboboxProps<T>) {
  const selected = selectedOptionProp ?? options.find((option) => option.id === value) ?? null;
  const items = selected && !options.some((option) => option.id === selected.id)
    ? [selected, ...options]
    : options;

  return (
    <Combobox.Root<T>
      items={items}
      value={selected}
      onValueChange={(nextValue) => {
        onSelectedOptionChange?.(nextValue);
        onValueChange(nextValue?.id ?? '');
      }}
      onInputValueChange={onSearchChange}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.id}
      isItemEqualToValue={(option, selectedValue) => option.id === selectedValue.id}
    >
      <Combobox.InputGroup className="relative flex min-h-12 w-full items-center rounded-md border border-hairline bg-surface-2 text-ink focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
        <Search size={15} aria-hidden="true" className="pointer-events-none ml-3 shrink-0 text-ink-tertiary" />
        <Combobox.Input
          aria-label="Cari dan pilih siswa aktif"
          aria-invalid={Boolean(errorMessage)}
          placeholder="Cari nama, NIS, atau kelas..."
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs outline-none placeholder:text-ink-tertiary"
        />
        <Combobox.Trigger
          type="button"
          aria-label="Buka daftar siswa"
          disabled={disabled}
          className="mr-1 flex size-11 shrink-0 items-center justify-center rounded text-ink-tertiary hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronDown size={16} aria-hidden="true" />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-[70] w-[var(--anchor-width)] outline-none">
          <Combobox.Popup className="max-h-64 overflow-hidden rounded-lg border border-hairline bg-surface-3 p-1 text-ink shadow-xl">
            <Combobox.List className="max-h-60 overflow-y-auto overscroll-contain">
              {isLoading && <div className="px-3 py-3 text-xs text-ink-tertiary" role="status">Mencari siswa...</div>}
              <Combobox.Empty className="px-3 py-3 text-xs text-ink-tertiary">
                {isLoading ? '' : 'Siswa aktif tidak ditemukan.'}
              </Combobox.Empty>
              {!isLoading && items.map((option) => (
                <Combobox.Item
                  key={option.id}
                  value={option}
                  className={cn(
                    'flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-xs outline-none',
                    'data-highlighted:bg-primary/10 data-highlighted:text-ink',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{option.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-ink-tertiary">{option.secondaryLabel}</span>
                  </span>
                  <Combobox.ItemIndicator className="text-primary">
                    <Check size={15} aria-hidden="true" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              ))}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
