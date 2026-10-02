
import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { authService } from '@/features/auth/api/auth.service';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { toast, Toaster } from '@/shared/ui/primitives/toast';

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

interface SessionProvidersProps extends AppProvidersProps {
  sessionIdentity: string;
}

function SessionProviders({ children, sessionIdentity }: SessionProvidersProps) {
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
          onSuccess: (_data, _variables, _context, mutation) => {
            const currentIdentity = useAuthStore.getState().user?.id ?? 'anonymous';
            if (currentIdentity !== sessionIdentity) return;

            const feedback = mutation.meta as {
              suppressSuccessToast?: boolean;
              successMessage?: string;
            } | undefined;
            if (feedback?.suppressSuccessToast) return;

            toast.add({
              type: 'success',
              title: 'Berhasil',
              description: feedback?.successMessage ?? 'Perubahan berhasil diterapkan.',
            });
          },
        }),
      }),
  );

  useEffect(
    () => () => {
      void queryClient.cancelQueries();
      queryClient.clear();
    },
    [queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionBootstrap />
      {children}
    </QueryClientProvider>
  );
}

export function AppProviders({ children }: AppProvidersProps) {
  const sessionIdentity = useAuthStore((state) => state.user?.id ?? 'anonymous');

  return (
    <>
      <Toaster />
      <SessionProviders key={sessionIdentity} sessionIdentity={sessionIdentity}>
        {children}
      </SessionProviders>
    </>
  );
}
