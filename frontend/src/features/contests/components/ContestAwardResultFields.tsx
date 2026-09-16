import { createContext, useContext } from 'react';
import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { isOneOf } from '@/shared/utils/isOneOf';

import {
  CONTEST_FINALIZE_RESULT_KIND_VALUES,
  type ContestFinalizeResultKind,
} from '../types/contests.types';
import {
  CONTEST_FINALIZE_RESULT_KIND_OPTIONS,
  getContestFinalizeResultKindLabel,
} from '../utils/contestLabels';
import {
  type AwardResultDraft,
} from '../utils/contestPipelineRules';

interface ContestAwardResultFieldsProps {
  resultRows: AwardResultDraft[];
  onAddResult: () => void;
  onRemoveResult: (resultRowIndex: number) => void;
  onResultTitleChange: (resultRowIndex: number, title: string) => void;
  onResultKindChange: (resultRowIndex: number, kind: ContestFinalizeResultKind) => void;
  onResultPositionChange: (resultRowIndex: number, position: string) => void;
  children: ReactNode;
}

type ContestAwardResultFieldsContextValue = Omit<ContestAwardResultFieldsProps, 'children'>;

const ContestAwardResultFieldsContext = createContext<ContestAwardResultFieldsContextValue | null>(null);

function useContestAwardResultFieldsContext(): ContestAwardResultFieldsContextValue {
  const context = useContext(ContestAwardResultFieldsContext);
  if (!context) {
    throw new Error('ContestAwardResultFields compound component harus berada di dalam root.');
  }
  return context;
}

function ContestAwardResultFieldsRoot({
  children,
  resultRows,
  onAddResult,
  onRemoveResult,
  onResultTitleChange,
  onResultKindChange,
  onResultPositionChange,
}: ContestAwardResultFieldsProps): ReactElement {
  return (
    <ContestAwardResultFieldsContext.Provider
      value={{
        resultRows,
        onAddResult,
        onRemoveResult,
        onResultTitleChange,
        onResultKindChange,
        onResultPositionChange,
      }}
    >
      <div className="space-y-3">{children}</div>
    </ContestAwardResultFieldsContext.Provider>
  );
}

function ContestAwardResultFieldsHeader(): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold text-ink">Hasil penghargaan</p>
        <p className="text-[11px] text-ink-tertiary">
          Tambahkan semua hasil yang diperoleh karya ini.
        </p>
      </div>
      <ContestAwardResultFieldsAddButton />
    </div>
  );
}

function ContestAwardResultFieldsAddButton(): ReactElement {
  const { onAddResult } = useContestAwardResultFieldsContext();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1 text-[11px]"
      onClick={onAddResult}
    >
      <Plus size={12} /> Tambah hasil
    </Button>
  );
}

function ContestAwardResultFieldsList(): ReactElement {
  const { resultRows } = useContestAwardResultFieldsContext();

  return (
    <div className="space-y-3">
      {resultRows.map((resultRow, resultRowIndex) => (
        <ContestAwardResultRow
          key={resultRowIndex}
          resultRow={resultRow}
          resultRowIndex={resultRowIndex}
        />
      ))}
    </div>
  );
}

interface ContestAwardResultRowProps {
  resultRow: AwardResultDraft;
  resultRowIndex: number;
}

function ContestAwardResultRow({
  resultRow,
  resultRowIndex,
}: ContestAwardResultRowProps): ReactElement {
  const {
    onRemoveResult,
    onResultTitleChange,
    onResultKindChange,
    onResultPositionChange,
  } = useContestAwardResultFieldsContext();
  const handleResultKindValueChange = (value: string | null) => {
    if (value === null) return;
    if (!isOneOf(value, CONTEST_FINALIZE_RESULT_KIND_VALUES)) return;
    onResultKindChange(resultRowIndex, value);
  };

  return (
    <div className="space-y-3 rounded-lg border border-hairline bg-surface-2 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink">Hasil {resultRowIndex + 1}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-semantic-danger"
          aria-label={'Hapus hasil ' + (resultRowIndex + 1)}
          onClick={() => onRemoveResult(resultRowIndex)}
        >
          <Trash2 size={14} />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={'result-title-' + resultRowIndex} className="text-xs text-ink-muted">
          Nama penghargaan *
        </Label>
        <Input
          id={'result-title-' + resultRowIndex}
          value={resultRow.result_title}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onResultTitleChange(resultRowIndex, event.target.value);
          }}
          placeholder="Contoh: Best Student Short Film"
          className="bg-surface-1 text-sm"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-ink-muted">Jenis hasil *</Label>
          <Select
            value={resultRow.result_kind}
            onValueChange={handleResultKindValueChange}
          >
            <SelectTrigger className="bg-surface-1 text-sm">
              <SelectValue>{getContestFinalizeResultKindLabel(resultRow.result_kind)}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-surface-3 text-ink">
              {CONTEST_FINALIZE_RESULT_KIND_OPTIONS.map((resultKindOption) => (
                <SelectItem key={resultKindOption.value} value={resultKindOption.value}>
                  {resultKindOption.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={'result-position-' + resultRowIndex} className="text-xs text-ink-muted">
            Posisi {resultRow.result_kind === 'rank' ? '*' : '(tidak diperlukan)'}
          </Label>
          <Input
            id={'result-position-' + resultRowIndex}
            value={resultRow.position}
            disabled={resultRow.result_kind !== 'rank'}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onResultPositionChange(
                resultRowIndex,
                event.target.value.replace(/\D/g, ''),
              );
            }}
            placeholder="Contoh: 1"
            inputMode="numeric"
            className="bg-surface-1 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

interface ContestAwardResultFieldsCompoundComponent {
  (props: ContestAwardResultFieldsProps): ReactElement;
  Header: typeof ContestAwardResultFieldsHeader;
  List: typeof ContestAwardResultFieldsList;
  AddButton: typeof ContestAwardResultFieldsAddButton;
}

export const ContestAwardResultFields: ContestAwardResultFieldsCompoundComponent = Object.assign(
  ContestAwardResultFieldsRoot,
  {
    Header: ContestAwardResultFieldsHeader,
    List: ContestAwardResultFieldsList,
    AddButton: ContestAwardResultFieldsAddButton,
  },
);
