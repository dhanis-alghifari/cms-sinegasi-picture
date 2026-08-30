// src/features/users/routes.tsx
// User management feature routes

import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const UsersPage = lazy(() =>
  import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })),
);

export const userRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['users.manage']} />,
    children: [{
      path: 'users',
      element: <Suspense fallback={<PageLoader />}><UsersPage /></Suspense>,
    }],
  },
];
