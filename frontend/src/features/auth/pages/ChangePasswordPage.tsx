import { useNavigate } from 'react-router-dom';
import { PasswordChangeForm } from '../components/PasswordChangeForm';

export function ChangePasswordPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-full p-4 sm:p-6">
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <h1 className="text-ink text-xl font-semibold">Ganti Password</h1>
          <p className="text-ink-subtle text-sm mt-1">Kelola password akun Anda tanpa keluar dari aplikasi.</p>
        </div>
        <PasswordChangeForm onSuccess={() => navigate('/dashboard', { replace: true })} onCancel={() => navigate('/dashboard')} />
      </div>
    </main>
  );
}
