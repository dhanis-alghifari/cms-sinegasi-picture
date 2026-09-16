
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { PasswordChangeForm } from '../components/PasswordChangeForm';
import { useNavigate } from 'react-router-dom';

export function ForceChangePasswordPage() {
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <PasswordChangeForm forced onSuccess={() => navigate('/dashboard', { replace: true })} />
    </AuthLayout>
  );
}
