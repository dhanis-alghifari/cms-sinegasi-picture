import { cn } from '@/shared/utils/cn';

interface FieldErrorProps {
  id?: string;
  message?: string | null;
  className?: string;
}

export function FieldError({ id, message, className }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className={cn('text-[10px] leading-4 text-semantic-danger', className)}
    >
      {message}
    </p>
  );
}
