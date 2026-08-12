// src/features/dashboard/routes.tsx
// Dashboard feature routes

import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);

export const dashboardRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['dashboard.read.operational', 'dashboard.read.own']} />,
    children: [{
      path: 'dashboard',
      element: <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>,
    }],
  },
];
