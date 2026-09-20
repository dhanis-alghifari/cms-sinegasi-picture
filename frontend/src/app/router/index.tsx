
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import { FirstLoginRoute } from './FirstLoginRoute';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { authRoutes, firstLoginRoutes, passwordRoutes } from '@/features/auth/routes';
import { dashboardRoutes } from '@/features/dashboard/routes';
import { studentRoutes } from '@/features/students/routes';
import { userRoutes } from '@/features/users/routes';
import { cashRoutes } from '@/features/cash/routes';
import { attendanceRoutes } from '@/features/attendance/routes';
import { gradeRoutes } from '@/features/grades/routes';
import { equipmentRoutes } from '@/features/equipment/routes';
import { borrowingRoutes } from '@/features/borrowing/routes';
import { contestRoutes } from '@/features/contests/routes';
import { notificationRoutes } from '@/features/notifications/routes';
import { classRoutes } from '@/features/classes/routes';
import { auditRoutes } from '@/features/audit/routes';
import { accessControlRoutes } from '@/features/access-control/routes';
import { agendaRoutes } from '@/features/agenda/routes';

// The router module contains route elements alongside the router export.
// Fast Refresh's component-only rule does not apply to this boundary.
// eslint-disable-next-line react-refresh/only-export-components
const LazyDashboardLayout = lazy(() =>
  import('@/app/layouts/DashboardLayout').then((module) => ({
    default: module.DashboardLayout,
  })),
);

export const router = createBrowserRouter([
  // Public Routes (Auth)
  {
    element: <PublicRoute />,
    children: authRoutes,
  },

  // Protected Dashboard Application Routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <FirstLoginRoute />,
        children: firstLoginRoutes,
      },
      {
        element: (
          <Suspense fallback={<PageLoader label="Menyiapkan aplikasi..." />}>
            <LazyDashboardLayout />
          </Suspense>
        ),
        children: [
          ...passwordRoutes,
          ...dashboardRoutes,
          ...studentRoutes,
          ...classRoutes,
          ...userRoutes,
          ...cashRoutes,
          ...attendanceRoutes,
          ...gradeRoutes,
          ...equipmentRoutes,
          ...borrowingRoutes,
          ...contestRoutes,
          ...notificationRoutes,
          ...auditRoutes,
          ...accessControlRoutes,
          ...agendaRoutes,
          // Fallback root redirect to /dashboard
          {
            path: '/',
            element: <Navigate to="/dashboard" replace />,
          },
        ],
      },
    ],
  },

  // 404 Catch-all
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
