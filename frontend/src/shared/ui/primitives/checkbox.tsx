import * as React from 'react';

import { cn } from '@/shared/utils/cn';

type CheckboxProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'type'> & {
  ref?: React.Ref<HTMLInputElement>;
};

function Checkbox({ className, ref, ...props }: CheckboxProps) {
  return (
    <span className={cn('relative inline-flex size-4 shrink-0', className)}>
      <input
        {...props}
        ref={ref}
        type="checkbox"
        data-slot="checkbox"
        className="peer absolute inset-0 z-10 m-0 size-4 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[4px] border border-hairline-strong bg-surface-1 transition-[background-color,border-color,box-shadow] duration-150 peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 peer-focus-visible:ring-offset-1 peer-disabled:opacity-50 motion-reduce:transition-none"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute inset-0 m-auto size-3 scale-75 text-white opacity-0 transition-[opacity,transform] duration-150 peer-checked:scale-100 peer-checked:opacity-100 motion-reduce:transition-none"
        fill="none"
      >
        <path d="m3.25 8.25 3 3 6.5-6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
      </svg>
    </span>
  );
}

export { Checkbox };
