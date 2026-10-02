
import { useMutation } from '@tanstack/react-query';
import { authService } from '../api/auth.service';
import { useAuthStore } from '../hooks/useAuthStore';
import type { ChangePasswordRequest } from '../types/auth.types';

export function useChangePasswordMutation() {
  const { setSession } = useAuthStore();

  return useMutation({
    meta: { successMessage: 'Password berhasil diperbarui.' },
    mutationFn: (data: ChangePasswordRequest) => authService.changePassword(data),
    onSuccess: (response) => {
      // Replace the JWT as well; the old first-login claim must not survive.
      setSession(response.user, response.token);
    },
  });
}
