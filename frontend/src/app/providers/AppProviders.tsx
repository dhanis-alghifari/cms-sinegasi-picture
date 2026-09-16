
import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { authService } from '@/features/auth/api/auth.service';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';

interface AppProvidersProps {
  children: ReactNode;
}

function AuthSessionBootstrap() {
  const {
    authHydrated,
    isAuthenticated,
    token,
    updateUser,
    logout,
    setSessionChecked,
  } = useAuthStore();

  useEffect(() => {
    if (!authHydrated) return;

    if (!isAuthenticated || !token) {
      setSessionChecked(true);
      return;
    }

    let cancelled = false;
    setSessionChecked(false);

    authService.me()
      .then((user) => {
        if (!cancelled) updateUser(user);
      })
      .catch(() => {
        // Fail closed: an unverifiable session cannot enter the application.
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setSessionChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authHydrated, isAuthenticated, token, updateUser, logout, setSessionChecked]);

  return null;
}

export function AppProviders({ children }: AppProvidersProps) {
  // QueryClient initialized inside state to avoid re-creation across renders
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: 1,
            staleTime: 30_000,
            gcTime: 5 * 60_000,
          },
        },
        mutationCache: new MutationCache({
          onError: () => {
            // Handled in individual component handlers and toasts
          },
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionBootstrap />
      {children}
    </QueryClientProvider>
  );
}
