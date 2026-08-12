// src/features/auth/components/LoginForm.tsx
// Login form component — React Hook Form + Zod + Shadcn UI
// Constitution: Form State → React Hook Form + Zod mandatory

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/shared/api/errors';

import { loginSchema, type LoginFormValues } from '../schemas/loginSchema';
import { useLoginMutation } from '../mutations/useLoginMutation';

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const loginMutation = useLoginMutation();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await loginMutation.mutateAsync(data);
      onSuccess();
    } catch {
      // Error handled via loginMutation.error below
    }
  });

  return (
    <Card className="bg-surface-1 border-hairline shadow-none">
      <CardHeader className="pb-4">
        <CardTitle className="text-ink text-lg font-semibold">Masuk</CardTitle>
        <CardDescription className="text-ink-subtle text-sm">
          Masukkan username dan password untuk melanjutkan.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Server error */}
          {loginMutation.error && (
            <div
              role="alert"
              className="px-3 py-2 rounded-md bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-sm"
            >
              {getErrorMessage(loginMutation.error)}
            </div>
          )}

          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-ink-muted text-sm">
              Username
            </Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="Masukkan username"
              aria-invalid={!!form.formState.errors.username}
              aria-describedby={form.formState.errors.username ? 'username-error' : undefined}
              className={cn(
                'bg-surface-2 border-hairline text-ink placeholder:text-ink-tertiary',
                'focus:border-primary-focus focus:ring-1 focus:ring-primary-focus/50',
                form.formState.errors.username && 'border-semantic-danger focus:ring-semantic-danger/50',
              )}
              {...form.register('username')}
            />
            {form.formState.errors.username && (
              <p id="username-error" role="alert" className="text-semantic-danger text-xs">
                {form.formState.errors.username.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-ink-muted text-sm">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Masukkan password"
                aria-invalid={!!form.formState.errors.password}
                aria-describedby={form.formState.errors.password ? 'password-error' : undefined}
                className={cn(
                  'bg-surface-2 border-hairline text-ink placeholder:text-ink-tertiary pr-10',
                  'focus:border-primary-focus focus:ring-1 focus:ring-primary-focus/50',
                  form.formState.errors.password && 'border-semantic-danger focus:ring-semantic-danger/50',
                )}
                {...form.register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-subtle transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.formState.errors.password && (
              <p id="password-error" role="alert" className="text-semantic-danger text-xs">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-medium"
          >
            {loginMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Masuk...
              </>
            ) : (
              <>
                <LogIn size={16} className="mr-2" />
                Masuk
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
