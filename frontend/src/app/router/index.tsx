// src/app/router/index.tsx
// Root router definition — Constitution: composition of feature routes and layouts only
// Dependency Direction: App -> Router -> Layouts -> Feature Routes

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import { FirstLoginRoute } from './FirstLoginRoute';
import { DashboardLayout } from '@/layouts/DashboardLayout';
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
        element: <DashboardLayout />,
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
