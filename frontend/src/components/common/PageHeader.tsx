// src/components/common/PageHeader.tsx
// Reusable page header — title + optional subtitle + right slot for actions

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="text-ink font-semibold text-xl tracking-tight">{title}</h1>
        {subtitle && <p className="text-ink-subtle text-sm mt-0.5">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto md:shrink-0 [&>button]:min-h-11 [&>a]:min-h-11 md:[&>button]:min-h-8 md:[&>a]:min-h-8">
          {actions}
        </div>
      )}
    </div>
  );
}
