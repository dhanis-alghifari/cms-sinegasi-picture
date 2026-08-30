import { useEffect, useRef, useState, type ComponentProps, type FocusEvent, type Ref } from 'react';

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
export function FormattedNumberInput({
  value,
  onChange,
  onBlur,
  ref,
  ...props
}: FormattedNumberInputProps) {
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
}
