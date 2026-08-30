// src/features/auth/hooks/useAuthStore.ts
// Zustand auth store — client-side session state
// Holds: user, isAuthenticated
// Constitution: Global UI state (auth) → Provider/Context or Zustand store

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '../types/auth.types';
import { authService } from '../api/auth.service';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  authHydrated: boolean;
  sessionChecked: boolean;

  // Actions
  setSession: (user: AuthUser, token: string) => void;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
  setSessionChecked: (checked: boolean) => void;
  setAuthHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      authHydrated: false,
      sessionChecked: false,

      setSession: (user, token) => {
        authService.persistToken(token);
        set({ user, token, isAuthenticated: true, sessionChecked: false });
      },

      logout: () => {
        authService.clearToken();
        set({ user: null, token: null, isAuthenticated: false, sessionChecked: true });
      },

      updateUser: (user) => {
        set({ user, isAuthenticated: true });
      },

      setSessionChecked: (checked) => {
        set({ sessionChecked: checked });
      },

      setAuthHydrated: (hydrated) => {
        set({ authHydrated: hydrated });
      },
    }),
    {
      name: 'sinegasi_auth',
      // Only persist user & auth state — token is also in localStorage via client.ts
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setAuthHydrated(true);
      },
    },
  ),
);
