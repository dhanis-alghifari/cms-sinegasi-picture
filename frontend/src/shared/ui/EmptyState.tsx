// src/shared/ui/EmptyState.tsx
// Reusable empty state — icon, title, description, optional CTA

import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center mb-4">
        <Icon size={22} className="text-ink-tertiary" strokeWidth={1.5} />
      </div>
      <h3 className="text-ink text-sm font-medium mb-1">{title}</h3>
      {description && <p className="text-ink-subtle text-sm max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
