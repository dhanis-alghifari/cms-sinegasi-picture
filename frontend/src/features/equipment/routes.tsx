
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteContentSkeleton } from '@/shared/ui/LoadingSkeletons';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

const EquipmentPage = lazy(() =>
  import('./pages/EquipmentPage').then((m) => ({ default: m.EquipmentPage })),
);

export const equipmentRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['equipment.read']} />,
    children: [{
      path: 'equipment',
      element: <Suspense fallback={<RouteContentSkeleton />}><EquipmentPage /></Suspense>,
    }],
  },
];
