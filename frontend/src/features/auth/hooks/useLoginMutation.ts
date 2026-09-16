
import { useMutation } from '@tanstack/react-query';
import { authService } from '../api/auth.service';
import { useAuthStore } from '../hooks/useAuthStore';
import type { LoginRequest } from '../types/auth.types';

export function useLoginMutation() {
  const { setSession } = useAuthStore();

  return useMutation({
    mutationFn: (data: LoginRequest) => authService.login(data),
    onSuccess: (response) => {
      setSession(response.user, response.token);
    },
  });
}
