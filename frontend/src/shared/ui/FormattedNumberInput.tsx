import { useEffect, useRef, useState, type ChangeEvent, type ComponentProps, type FocusEvent, type Ref } from 'react';

import { Input } from '@/shared/ui/primitives/input';
import { formatNumberInput, parseNumericInput } from '@/shared/utils/formatNumber';

type InputProps = Omit<ComponentProps<typeof Input>, 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'type'>;

interface FormattedNumberInputProps extends InputProps {
  value?: number | null;
  onChange: (value: number | undefined) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  ref?: Ref<HTMLInputElement>;
}

/** Numeric input with readable grouping while preserving a numeric form value. */
export function FormattedNumberInput({ value, onChange, onBlur, ref, ...props }: FormattedNumberInputProps) {
  const [draft, setDraft] = useState(() => formatNumberInput(value));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setDraft(formatNumberInput(value));
  }, [value]);

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    isFocused.current = false;
    const parsed = parseNumericInput(draft);
    setDraft(formatNumberInput(parsed));
    onBlur?.(event);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const rawValue = input.value;
    const rawCursor = input.selectionStart ?? rawValue.length;
    const nextDraft = rawValue.replace(/[^0-9.-]/g, '');
    const parsed = parseNumericInput(nextDraft);
    const isIntermediateValue = nextDraft === '' || nextDraft === '-' || nextDraft.endsWith('.') || nextDraft.endsWith('-.');
    const formattedValue = isIntermediateValue ? nextDraft : formatNumberInput(parsed);
    const digitsBeforeCursor = rawValue.slice(0, rawCursor).replace(/[^0-9]/g, '').length;

    setDraft(formattedValue);
    onChange(parsed);

    if (formattedValue !== nextDraft) {
      requestAnimationFrame(() => {
        if (document.activeElement !== input) return;
        let cursor = 0;
        if (digitsBeforeCursor > 0) {
          let seenDigits = 0;
          cursor = formattedValue.length;
          for (let index = 0; index < formattedValue.length; index += 1) {
            if (!/[0-9]/.test(formattedValue[index])) continue;
            seenDigits += 1;
            if (seenDigits >= digitsBeforeCursor) {
              cursor = index + 1;
              break;
            }
          }
        }
        input.setSelectionRange(cursor, cursor);
      });
    }
  };

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={draft}
      onFocus={() => {
        isFocused.current = true;
      }}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
