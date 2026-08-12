// src/features/classes/routes.tsx

import type { RouteObject } from 'react-router-dom';
import { ClassesPage } from './pages/ClassesPage';
import { CapabilityRoute } from '@/app/router/CapabilityRoute';

export const classRoutes: RouteObject[] = [
  {
    element: <CapabilityRoute capabilities={['classes.read']} />,
    children: [{ path: 'classes', element: <ClassesPage /> }],
  },
];
