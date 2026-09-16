
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { formatNumber } from '@/shared/utils/formatNumber';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: PaginationProps) {
  if (total === 0 || totalPages <= 1) {
    return null;
  }

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-hairline text-xs">
      <div className="text-ink-subtle">
        Menampilkan <span className="font-semibold text-ink">{formatNumber(startItem)}</span>–
        <span className="font-semibold text-ink">{formatNumber(endItem)}</span> dari{' '}
        <span className="font-semibold text-ink">{formatNumber(total)}</span> data
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-8 px-2.5 bg-surface-2 border-hairline text-ink text-xs disabled:opacity-40"
        >
          <ChevronLeft size={14} className="mr-1" />
          Sebelumnya
        </Button>

        <div className="px-2 text-ink-subtle font-medium">
          Halaman <span className="text-ink font-semibold">{formatNumber(page)}</span> dari{' '}
          <span className="text-ink font-semibold">{formatNumber(totalPages)}</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-8 px-2.5 bg-surface-2 border-hairline text-ink text-xs disabled:opacity-40"
        >
          Selanjutnya
          <ChevronRight size={14} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}
