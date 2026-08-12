// src/layouts/AuthLayout.tsx
// Layout for public pages (Login, Force Change Password)
// Constitution: No fetch, no mutation, no business logic in layouts

import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-inverse-surface-1 px-4 text-inverse-ink">
      {/* Subtle background texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sidebar-accent/70 via-inverse-surface-1 to-inverse-surface-1 pointer-events-none" />

      {/* Auth card container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">S</span>
            </div>
          <span className="text-inverse-ink font-semibold text-lg tracking-tight">Sinegasi CMS</span>
          </div>
          <p className="text-inverse-ink/70 text-sm">Sistem Manajemen Sinematografi</p>
        </div>

        {children}
      </div>
    </div>
  );
}
