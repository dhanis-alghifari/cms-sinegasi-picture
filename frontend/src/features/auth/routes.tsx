// src/features/auth/routes.tsx
// Auth feature routes — Constitution: each feature owns its routes.tsx

import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoader } from '@/components/common/LoadingSpinner';

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);

const ForceChangePasswordPage = lazy(() =>
  import('./pages/ForceChangePasswordPage').then((m) => ({
    default: m.ForceChangePasswordPage,
  })),
);

const ChangePasswordPage = lazy(() =>
  import('./pages/ChangePasswordPage').then((m) => ({ default: m.ChangePasswordPage })),
);

export const authRoutes: RouteObject[] = [
  {
    path: 'login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    ),
  },
];

export const firstLoginRoutes: RouteObject[] = [
  {
    path: 'ganti-password',
    element: (
      <Suspense fallback={<PageLoader />}>
        <ForceChangePasswordPage />
      </Suspense>
    ),
  },
];

export const passwordRoutes: RouteObject[] = [
  {
    path: 'pengaturan/keamanan',
    element: (
      <Suspense fallback={<PageLoader />}>
        <ChangePasswordPage />
      </Suspense>
    ),
  },
];
