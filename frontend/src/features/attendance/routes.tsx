// src/features/attendance/routes.tsx
// Attendance feature routes

import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const AttendancePage = lazy(() =>
  import('./pages/AttendancePage').then((m) => ({ default: m.AttendancePage })),
);

export const attendanceRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['attendance.read', 'attendance.read.own']} />,
    children: [{
      path: 'attendance',
      element: <Suspense fallback={<PageLoader />}><AttendancePage /></Suspense>,
    }],
  },
];
