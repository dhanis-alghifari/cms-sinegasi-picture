import { useState } from 'react';
import { Button } from '@/shared/ui/primitives/button';
import { SearchableCombobox } from '@/shared/ui/SearchableCombobox';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { formatRoleLabel } from '@/shared/utils/formatLabels';
import type { UnlinkedStudentAccount } from '../types/students.types';
import { useUnlinkedStudentAccountsQuery } from '../hooks/useUnlinkedStudentAccountsQuery';

interface LegacyStudentAccountPickerProps {
  selectedAccount: UnlinkedStudentAccount | null;
  onSelectedAccountChange: (account: UnlinkedStudentAccount | null) => void;
  disabled?: boolean;
  errorMessage?: string | null;
  errorId?: string;
}

export function LegacyStudentAccountPicker({
  selectedAccount,
  onSelectedAccountChange,
  disabled = false,
  errorMessage,
  errorId,
}: LegacyStudentAccountPickerProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, UI_CONSTANTS.SEARCH_DEBOUNCE_MS);
  const accountsQuery = useUnlinkedStudentAccountsQuery(debouncedSearch, !disabled);
  const options = (accountsQuery.data ?? []).map((account) => ({
    ...account,
    label: account.username,
    secondaryLabel: `${account.nama} · ${formatRoleLabel(account.role)}`,
  }));
  const selectedOption = selectedAccount
    ? {
      ...selectedAccount,
      label: selectedAccount.username,
      secondaryLabel: `${selectedAccount.nama} · ${formatRoleLabel(selectedAccount.role)}`,
    }
    : null;

  const handleValueChange = (id: string) => {
    onSelectedAccountChange(options.find((option) => option.id === id) ?? null);
  };

  return (
    <div className="space-y-1.5">
      <SearchableCombobox
        options={options}
        value={selectedAccount?.id}
        selectedOption={selectedOption}
        onValueChange={handleValueChange}
        onSelectedOptionChange={onSelectedAccountChange}
        onSearchChange={setSearch}
        isLoading={accountsQuery.isLoading || accountsQuery.isFetching}
        disabled={disabled}
        errorMessage={errorMessage ?? undefined}
        errorId={errorMessage ? errorId : undefined}
        ariaLabel="Cari akun siswa lama berdasarkan username atau nama"
        triggerLabel="Buka daftar akun siswa lama"
        placeholder="Cari username atau nama akun..."
        emptyMessage={debouncedSearch ? 'Akun yang cocok tidak ditemukan.' : 'Tidak ada akun siswa lama yang belum ditautkan.'}
        loadingMessage="Memuat akun siswa yang belum ditautkan..."
      />
      {accountsQuery.isError && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-semantic-danger">
          <span role="status">Daftar akun lama belum dapat dimuat.</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => void accountsQuery.refetch()} className="min-h-9 text-xs">
            Coba lagi
          </Button>
        </div>
      )}
    </div>
  );
}
