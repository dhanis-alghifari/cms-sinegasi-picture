// src/features/cash/routes.tsx
// Cash feature routes

import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const CashPage = lazy(() =>
  import('./pages/CashPage').then((m) => ({ default: m.CashPage })),
);

export const cashRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['cash.read', 'cash.read.own']} />,
    children: [{
      path: 'cash',
      element: <Suspense fallback={<PageLoader />}><CashPage /></Suspense>,
    }],
  },
];
