// src/features/students/routes.tsx
// Students feature routes

import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const StudentsPage = lazy(() =>
  import('./pages/StudentsPage').then((m) => ({ default: m.StudentsPage })),
);

export const studentRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['students.read']} />,
    children: [{
      path: 'students',
      element: <Suspense fallback={<PageLoader />}><StudentsPage /></Suspense>,
    }],
  },
];
