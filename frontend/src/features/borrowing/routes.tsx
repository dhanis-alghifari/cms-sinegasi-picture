// src/features/borrowing/routes.tsx
// Borrowing feature routes

import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const BorrowingPage = lazy(() =>
  import('./pages/BorrowingPage').then((m) => ({ default: m.BorrowingPage })),
);

export const borrowingRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['borrowing.read']} />,
    children: [{
      path: 'borrowing',
      element: <Suspense fallback={<PageLoader />}><BorrowingPage /></Suspense>,
    }],
  },
];
