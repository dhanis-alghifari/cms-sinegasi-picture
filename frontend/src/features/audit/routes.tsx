import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const AuditPage = lazy(() => import('./pages/AuditPage').then((module) => ({ default: module.AuditPage })));

export const auditRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['audit.read']} />,
    children: [{
      path: 'audit-logs',
      element: <Suspense fallback={<PageLoader />}><AuditPage /></Suspense>,
    }],
  },
];
