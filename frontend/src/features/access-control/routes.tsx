import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteContentSkeleton } from '@/shared/ui/LoadingSkeletons';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const AccessControlPage = lazy(() => import('./pages/AccessControlPage').then((module) => ({ default: module.AccessControlPage })));

export const accessControlRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['access_control.read']} />,
    children: [{
      path: 'access-control',
      element: <Suspense fallback={<RouteContentSkeleton />}><AccessControlPage /></Suspense>,
    }],
  },
];
