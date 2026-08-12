import { forwardRef, useEffect, useRef, useState, type ComponentProps, type FocusEvent } from 'react';

import { Input } from '@/components/ui/input';
import { formatNumberInput, parseNumericInput } from '@/shared/utils/formatNumber';

type InputProps = Omit<ComponentProps<typeof Input>, 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'type'>;

interface FormattedNumberInputProps extends InputProps {
  value?: number | null;
  onChange: (value: number | undefined) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
}

/** Numeric input with readable grouping while preserving a numeric form value. */
export const FormattedNumberInput = forwardRef<HTMLInputElement, FormattedNumberInputProps>(function FormattedNumberInput(
  { value, onChange, onBlur, ...props },
  ref,
) {
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
      onChange={(event) => {
        const nextDraft = event.target.value.replace(/[^0-9.-]/g, '');
        setDraft(nextDraft);
        onChange(parseNumericInput(nextDraft));
      }}
      onBlur={handleBlur}
    />
  );
});
