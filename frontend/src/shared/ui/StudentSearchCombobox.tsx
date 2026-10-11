import { SearchableCombobox, type SearchableComboboxOption } from './SearchableCombobox';

export type SearchableStudentOption = SearchableComboboxOption & { secondaryLabel: string };

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
  return (
    <SearchableCombobox
      {...{
        options,
        value,
        selectedOption: selectedOptionProp,
        onValueChange,
        onSelectedOptionChange,
        onSearchChange,
        isLoading,
        disabled,
        errorMessage,
      }}
      ariaLabel="Cari dan pilih siswa aktif"
      triggerLabel="Buka daftar siswa"
      placeholder="Cari nama, NIS, atau kelas..."
      emptyMessage="Siswa aktif tidak ditemukan."
      loadingMessage="Mencari siswa..."
    />
  );
}
