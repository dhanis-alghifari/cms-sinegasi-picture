import { useRef, useState, useEffect, useCallback, type ReactNode, type ChangeEvent } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/shared/utils/cn';

export type RadioGroupOption<Value extends string> = {
  value: Value;
  label: ReactNode;
  disabled?: boolean;
};

interface RadioGroupProps<Value extends string> {
  name: string;
  legend: ReactNode;
  value: Value | null | undefined;
  options: readonly RadioGroupOption<Value>[];
  onValueChange: (value: Value) => void;
  disabled?: boolean;
  className?: string;
}

export function RadioGroup<Value extends string>({
  name,
  legend,
  value,
  options,
  onValueChange,
  disabled = false,
  className,
}: RadioGroupProps<Value>) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the indicator aligned with the selected option in both row and
  // column layouts. Mobile switches the options to a column, so width/left
  // alone would incorrectly make the highlight span the entire group.
  const [indicator, setIndicator] = useState({ top: 0, left: 0, width: 0, height: 0 });

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeItem = container.querySelector<HTMLElement>('[data-checked="true"]');
    if (!activeItem) {
      setIndicator({ top: 0, left: 0, width: 0, height: 0 });
      return;
    }

    setIndicator({
      top: activeItem.offsetTop,
      left: activeItem.offsetLeft,
      width: activeItem.offsetWidth,
      height: activeItem.offsetHeight,
    });
  }, []);

  useEffect(() => {
    updateIndicator();
  }, [value, updateIndicator]);

  useEffect(() => {
    const observer = new ResizeObserver(updateIndicator);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateIndicator]);

  const handleSelect = (event: ChangeEvent<HTMLInputElement>, optionValue: Value) => {
    if (event.currentTarget.checked) {
      onValueChange(optionValue);
    }
  };

  return (
    <fieldset className={cn('min-w-0 space-y-1.5', className)} disabled={disabled}>
      <legend className="text-xs text-ink-subtle">{legend}</legend>

      <div
        ref={containerRef}
        className="relative flex min-h-[var(--touch-target-min)] min-w-0 flex-col items-stretch gap-1 rounded-lg border border-hairline bg-surface-2 p-1 sm:flex-row md:min-h-9"
      >
        <motion.div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute z-0 rounded-md bg-surface-1 shadow-sm',
            indicator.width === 0 && 'opacity-0',
          )}
          animate={{
            top: indicator.top,
            left: indicator.left,
            width: indicator.width,
            height: indicator.height,
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
            mass: 0.8,
          }}
        />

        {options.map((option) => {
          const isChecked = value === option.value;
          const isDisabled = disabled || option.disabled;

          return (
            <label
              key={option.value}
              data-checked={isChecked}
              className="relative z-10 min-w-0 flex-1 cursor-pointer"
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={isChecked}
                disabled={isDisabled}
                onChange={(e) => handleSelect(e, option.value)}
                className="peer sr-only"
              />

              <span
                className={cn(
                  'relative flex min-h-[var(--touch-target-min)] w-full items-center justify-center rounded-md border border-transparent px-3 py-2 text-center text-xs font-medium text-ink-subtle transition-colors duration-200 hover:text-ink md:min-h-9',
                  isChecked && 'font-semibold text-ink',
                  isDisabled && 'cursor-not-allowed opacity-50',
                  'peer-focus-visible:border-primary-focus peer-focus-visible:ring-2 peer-focus-visible:ring-primary-focus/50 peer-focus-visible:outline-none',
                )}
              >
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
