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
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Simpan posisi 'left' dan lebar 'width' pill putih
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  // 2. Ukur posisi opsi yang sedang aktif (berdasarkan data-checked)
  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeItem = container.querySelector<HTMLElement>('[data-checked="true"]');
    if (!activeItem) return;

    setIndicator({
      left: activeItem.offsetLeft,
      width: activeItem.offsetWidth,
    });
  }, []);

  // 3. Jalankan ulang pengukuran saat nilai aktif berubah
  useEffect(() => {
    updateIndicator();
  }, [value, updateIndicator]);

  // 4. Jalankan ulang jika ukuran layar/dialog berubah (responsif)
  useEffect(() => {
    const observer = new ResizeObserver(updateIndicator);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateIndicator]);

  // 5. Handler saat opsi diklik
  const handleSelect = (event: ChangeEvent<HTMLInputElement>, optionValue: Value) => {
    if (event.currentTarget.checked) {
      onValueChange(optionValue);
    }
  };

  return (
    <fieldset className={cn('min-w-0 space-y-1.5', className)} disabled={disabled}>
      <legend className="text-xs text-ink-subtle">{legend}</legend>

      {/* Kotak bar abu-abu tempat tombol berada */}
      <div
        ref={containerRef}
        className="relative flex min-h-[var(--touch-target-min)] min-w-0 flex-col items-stretch gap-1 rounded-lg border border-hairline bg-surface-2 p-1 sm:flex-row md:min-h-9"
      >
        {/* Satu pill putih yang meluncur mulus (spring physics) */}
        <motion.div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-1 bottom-1 z-0 rounded-md bg-surface-1 shadow-sm',
            indicator.width === 0 && 'opacity-0',
          )}
          animate={{
            left: indicator.left,
            width: indicator.width,
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
            mass: 0.8,
          }}
        />

        {/* Daftar opsi pilihan */}
        {options.map((option) => {
          const isChecked = value === option.value;
          const isDisabled = disabled || option.disabled;

          return (
            <label
              key={option.value}
              data-checked={isChecked}
              className="relative z-10 min-w-0 flex-1 cursor-pointer"
            >
              {/* Radio input standar (tersembunyi tapi ramah keyboard & form accessibility) */}
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={isChecked}
                disabled={isDisabled}
                onChange={(e) => handleSelect(e, option.value)}
                className="peer sr-only"
              />

              {/* Tampilan teks opsi */}
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
