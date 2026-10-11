
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteContentSkeleton } from '@/shared/ui/LoadingSkeletons';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const AttendancePage = lazy(() =>
  import('./pages/AttendancePage').then((m) => ({ default: m.AttendancePage })),
);

export const attendanceRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['attendance.read', 'attendance.read.own']} />,
    children: [{
      path: 'attendance',
      element: <Suspense fallback={<RouteContentSkeleton />}><AttendancePage /></Suspense>,
    }],
  },
];
