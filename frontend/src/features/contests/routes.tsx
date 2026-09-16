
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const ContestsPage = lazy(() =>
  import('./pages/ContestsPage').then((m) => ({ default: m.ContestsPage })),
);

export const contestRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['contests.read']} />,
    children: [{
      path: 'contests',
      element: <Suspense fallback={<PageLoader />}><ContestsPage /></Suspense>,
    }],
  },
];
