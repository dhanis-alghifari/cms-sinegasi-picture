// src/features/auth/pages/LoginPage.tsx
// Login page — thin orchestration layer (Constitution: Page = composition only)
// Playbook-09: Login → validate → receive token → store session → protected routes

import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { LoginForm } from '../components/LoginForm';
import { useAuthStore } from '../hooks/useAuthStore';

export function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleLoginSuccess = () => {
    // PRD: First-login enforcement — redirect to force change password
    if (user?.is_first_login) {
      navigate('/ganti-password', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <AuthLayout>
      <LoginForm onSuccess={handleLoginSuccess} />
    </AuthLayout>
  );
}
