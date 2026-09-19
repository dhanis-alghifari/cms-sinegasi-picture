
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteContentSkeleton } from '@/shared/ui/LoadingSkeletons';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const ContestsPage = lazy(() =>
  import('./pages/ContestsPage').then((m) => ({ default: m.ContestsPage })),
);

export const contestRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['contests.read']} />,
    children: [{
      path: 'contests',
      element: <Suspense fallback={<RouteContentSkeleton />}><ContestsPage /></Suspense>,
    }],
  },
];
