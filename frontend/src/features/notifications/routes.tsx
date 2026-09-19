
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteContentSkeleton } from '@/shared/ui/LoadingSkeletons';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);

export const notificationRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['notifications.read']} />,
    children: [{
      path: 'notifications',
      element: <Suspense fallback={<RouteContentSkeleton />}><NotificationsPage /></Suspense>,
    }],
  },
];
