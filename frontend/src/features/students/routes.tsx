
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteContentSkeleton } from '@/shared/ui/LoadingSkeletons';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const StudentsPage = lazy(() =>
  import('./pages/StudentsPage').then((m) => ({ default: m.StudentsPage })),
);

export const studentRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['students.read']} />,
    children: [{
      path: 'students',
      element: <Suspense fallback={<RouteContentSkeleton />}><StudentsPage /></Suspense>,
    }],
  },
];
