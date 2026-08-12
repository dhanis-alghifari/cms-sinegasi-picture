// src/features/grades/routes.tsx
// Grades feature routes

import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const GradesPage = lazy(() =>
  import('./pages/GradesPage').then((m) => ({ default: m.GradesPage })),
);

export const gradeRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['grades.read', 'grades.read.own']} />,
    children: [{
      path: 'grades',
      element: <Suspense fallback={<PageLoader />}><GradesPage /></Suspense>,
    }],
  },
];
