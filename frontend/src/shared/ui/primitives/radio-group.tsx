import * as React from 'react';
import { LazyMotion, MotionConfig, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';

import { cn } from '@/shared/utils/cn';

const loadMotionFeatures = () => import('../motion/motion-features').then(({ default: features }) => features);

export type RadioGroupOption<Value extends string> = {
  value: Value;
  label: React.ReactNode;
  disabled?: boolean;
};

interface RadioGroupProps<Value extends string> {
  name: string;
  legend: React.ReactNode;
  value: Value;
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
  const shouldReduceMotion = useReducedMotion();

  const handleOptionChange = (event: React.ChangeEvent<HTMLInputElement>, optionValue: Value) => {
    if (event.currentTarget.checked) onValueChange(optionValue);
  };

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures}>
        <fieldset className={cn('min-w-0 space-y-1.5', className)} disabled={disabled}>
          <legend className="text-xs text-ink-subtle">{legend}</legend>
          <div className="flex min-h-[var(--touch-target-min)] min-w-0 flex-col items-stretch gap-1 rounded-lg border border-hairline bg-surface-2 p-1 sm:flex-row md:min-h-9">
            {options.map((option) => (
              <label key={option.value} className="relative min-w-0 flex-1 cursor-pointer">
                <input
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={value === option.value}
                  disabled={disabled || option.disabled}
                  onChange={(event) => handleOptionChange(event, option.value)}
                  className="peer sr-only"
                />
                <span className="relative flex min-h-[var(--touch-target-min)] w-full items-center justify-center overflow-hidden rounded-md border border-transparent px-3 py-2 text-center text-xs font-medium text-ink-subtle transition-[background-color,color,box-shadow] duration-200 hover:text-ink peer-checked:font-semibold peer-checked:text-ink peer-focus-visible:border-primary-focus peer-focus-visible:ring-2 peer-focus-visible:ring-primary-focus/50 peer-focus-visible:ring-offset-0 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 md:min-h-9">
                  {value === option.value && (
                    <m.span
                      layoutId={`radio-${name}-active`}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-md bg-surface-1 shadow-sm"
                      initial={false}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeOut' }}
                    />
                  )}
                  <span className="relative z-10">{option.label}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </LazyMotion>
    </MotionConfig>
  );
}
