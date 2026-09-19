
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteContentSkeleton } from '@/shared/ui/LoadingSkeletons';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const UsersPage = lazy(() =>
  import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })),
);

export const userRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['users.manage']} />,
    children: [{
      path: 'users',
      element: <Suspense fallback={<RouteContentSkeleton />}><UsersPage /></Suspense>,
    }],
  },
];
