
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';
import { RouteContentSkeleton } from '@/shared/ui/LoadingSkeletons';

const ClassesPage = lazy(() =>
  import('./pages/ClassesPage').then((module) => ({ default: module.ClassesPage })),
);

export const classRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['classes.read']} />,
    children: [{
      path: 'classes',
      element: <Suspense fallback={<RouteContentSkeleton />}><ClassesPage /></Suspense>,
    }],
  },
];
