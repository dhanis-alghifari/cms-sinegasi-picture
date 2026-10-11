import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';
import { RouteContentSkeleton } from '@/shared/ui/LoadingSkeletons';

const AgendaPage = lazy(() => import('./pages/AgendaPage').then((module) => ({ default: module.AgendaPage })));

export const agendaRoutes: RouteObject[] = [{
  element: <CapabilityRoute capabilities={['agenda.read']} />,
  children: [{ path: 'agenda', element: <Suspense fallback={<RouteContentSkeleton />}><AgendaPage /></Suspense> }],
}];
