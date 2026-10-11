
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteContentSkeleton } from '@/shared/ui/LoadingSkeletons';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);

export const dashboardRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['dashboard.read.operational', 'dashboard.read.own']} />,
    children: [{
      path: 'dashboard',
      element: <Suspense fallback={<RouteContentSkeleton />}><DashboardPage /></Suspense>,
    }],
  },
];
