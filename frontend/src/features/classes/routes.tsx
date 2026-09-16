
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';
import { PageLoader } from '@/shared/ui/LoadingSpinner';

const ClassesPage = lazy(() =>
  import('./pages/ClassesPage').then((module) => ({ default: module.ClassesPage })),
);

export const classRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['classes.read']} />,
    children: [{
      path: 'classes',
      element: <Suspense fallback={<PageLoader />}><ClassesPage /></Suspense>,
    }],
  },
];
