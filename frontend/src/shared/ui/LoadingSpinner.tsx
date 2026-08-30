// src/shared/ui/LoadingSpinner.tsx
// Reusable loading spinner with optional label

import { cn } from '@/shared/utils/cn';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export function LoadingSpinner({ size = 'md', label, className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-2',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <div
        role="status"
        aria-label={label ?? 'Memuat...'}
        className={cn(
          'rounded-full border-hairline-strong border-t-primary animate-spin',
          sizeClasses[size],
        )}
      />
      {label && <p className="text-ink-subtle text-xs">{label}</p>}
    </div>
  );
}

// Full page loading state
export function PageLoader() {
  return (
    <div className="flex min-h-[min(50dvh,400px)] items-center justify-center px-4">
      <LoadingSpinner size="lg" label="Memuat data..." />
    </div>
  );
}
