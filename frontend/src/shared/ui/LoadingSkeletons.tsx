import type { ReactNode } from 'react';

import { cn } from '@/shared/utils/cn';
import { Skeleton } from '@/shared/ui/primitives/skeleton';

interface LoadingRegionProps {
  children: ReactNode;
  label?: string;
  className?: string;
}

export function LoadingRegion({
  children,
  label = 'Memuat data...',
  className,
}: LoadingRegionProps) {
  return (
    <div
      className={cn('min-w-0', className)}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

interface MetricCardsSkeletonProps {
  count?: number;
  label?: string;
  className?: string;
}

export function MetricCardsSkeleton({ count = 4, label = 'Memuat ringkasan...', className }: MetricCardsSkeletonProps) {
  return (
    <LoadingRegion label={label} className={className}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="rounded-xl border border-hairline bg-surface-1 p-4 sm:p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-28" />
            <Skeleton className="mt-4 h-3 w-20" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

interface DataTableSkeletonProps {
  columns?: number;
  rows?: number;
  mobile?: boolean;
  label?: string;
  className?: string;
}

const COLUMN_WIDTHS = ['w-3/4', 'w-5/6', 'w-2/3', 'w-4/5', 'w-1/2', 'w-3/5', 'w-2/5'];

export function DataTableSkeleton({
  columns = 5,
  rows = 5,
  mobile = false,
  label = 'Memuat daftar data...',
  className,
}: DataTableSkeletonProps) {
  if (mobile) {
    return <MobileCardListSkeleton rows={Math.min(rows, 4)} label={label} className={className} />;
  }

  return (
    <LoadingRegion label={label} className={className}>
      <div className="overflow-hidden rounded-lg border border-hairline bg-surface-1">
        <div className="grid gap-4 border-b border-hairline bg-surface-2/60 px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={index} className="h-3 w-2/3" />
          ))}
        </div>
        <div className="divide-y divide-hairline">
          {Array.from({ length: rows }, (_, rowIndex) => (
            <div key={rowIndex} className="grid items-center gap-4 px-4 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {Array.from({ length: columns }, (_, columnIndex) => (
                <Skeleton key={columnIndex} className={cn('h-4', COLUMN_WIDTHS[columnIndex % COLUMN_WIDTHS.length])} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

interface MobileCardListSkeletonProps {
  rows?: number;
  label?: string;
  className?: string;
}

export function MobileCardListSkeleton({ rows = 4, label = 'Memuat daftar data...', className }: MobileCardListSkeletonProps) {
  return (
    <LoadingRegion label={label} className={className}>
      <div className="space-y-3" aria-label={label}>
        {Array.from({ length: rows }, (_, index) => (
          <article key={index} className="rounded-xl border border-hairline bg-surface-1 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="mt-4 h-16 w-full rounded-lg" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </article>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function CompactListSkeleton({ rows = 3, label = 'Memuat daftar...', className }: { rows?: number; label?: string; className?: string }) {
  return (
    <LoadingRegion label={label} className={className}>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-1 px-3 py-2.5">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
            <Skeleton className="h-7 w-12 rounded-md" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function PanelSkeleton({ rows = 3, label = 'Memuat bagian data...', className }: { rows?: number; label?: string; className?: string }) {
  return (
    <LoadingRegion label={label} className={className}>
      <div className="space-y-3 rounded-xl border border-hairline bg-surface-1 p-4 sm:p-5">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className={cn('h-10 w-full rounded-lg', index === rows - 1 && 'h-16')} />
        ))}
      </div>
    </LoadingRegion>
  );
}

export function RefreshingIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <p className="text-right text-[11px] text-ink-tertiary" role="status" aria-live="polite">
      Memperbarui data...
    </p>
  );
}

export function RouteContentSkeleton() {
  return (
    <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:p-6" aria-busy="true" aria-label="Memuat halaman">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <MetricCardsSkeleton count={4} />
      <div className="hidden sm:block">
        <DataTableSkeleton columns={5} rows={4} />
      </div>
      <div className="sm:hidden">
        <MobileCardListSkeleton rows={4} />
      </div>
    </div>
  );
}
