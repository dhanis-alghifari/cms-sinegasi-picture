import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';
import { RouteContentSkeleton } from '@/shared/ui/LoadingSkeletons';

const SocialMediaPage = lazy(() => import('./pages/SocialMediaPage').then((module) => ({ default: module.SocialMediaPage })));

export const socialMediaRoutes: RouteObject[] = [{
  element: <CapabilityRoute capabilities={['social_media.read']} />,
  children: [{ path: 'social-media', element: <Suspense fallback={<RouteContentSkeleton />}><SocialMediaPage /></Suspense> }],
}];
