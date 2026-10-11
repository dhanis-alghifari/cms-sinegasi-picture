import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteContentSkeleton } from '@/shared/ui/LoadingSkeletons';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const AuditPage = lazy(() => import('./pages/AuditPage').then((module) => ({ default: module.AuditPage })));

export const auditRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['audit.read']} />,
    children: [{
      path: 'audit-logs',
      element: <Suspense fallback={<RouteContentSkeleton />}><AuditPage /></Suspense>,
    }],
  },
];
