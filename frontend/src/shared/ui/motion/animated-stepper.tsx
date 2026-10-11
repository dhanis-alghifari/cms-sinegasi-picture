import { AnimatePresence, LazyMotion, MotionConfig, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { Check } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { cn } from '@/shared/utils/cn';

const loadMotionFeatures = () => import('./motion-features').then(({ default: features }) => features);

const STEP_TRANSITION = {
  bounce: 0.1,
  duration: 0.25,
  type: 'spring' as const,
};

const LINE_TRANSITION = {
  duration: 0.25,
  ease: [0.645, 0.045, 0.355, 1] as const,
};

export interface AnimatedStepperStep {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export interface AnimatedStepperProps {
  steps: readonly AnimatedStepperStep[];
  currentStep: number;
  ariaLabel?: string;
  className?: string;
}

function normalizeStepIndex(currentStep: number, stepCount: number): number {
  if (!Number.isFinite(currentStep)) return 0;
  return Math.min(Math.max(Math.trunc(currentStep), 0), stepCount - 1);
}

function getStepLabelClassName(isActive: boolean, isCompleted: boolean): string {
  if (isActive) return 'text-ink';
  if (isCompleted) return 'text-primary';
  return 'text-ink-tertiary';
}

export function AnimatedStepper({
  steps,
  currentStep,
  ariaLabel = 'Progress steps',
  className,
}: AnimatedStepperProps) {
  const shouldReduceMotion = useReducedMotion();
  const stepperId = useId();

  if (steps.length === 0) return null;

  const activeStep = normalizeStepIndex(currentStep, steps.length);

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures}>
        <ol
          aria-label={ariaLabel}
          className={cn('flex w-full flex-col md:flex-row md:items-start', className)}
        >
          {steps.map((step, index) => {
            const isActive = index === activeStep;
            const isCompleted = index < activeStep;
            const hasNextStep = index < steps.length - 1;

            return (
              <li
                key={`${stepperId}-${step.id}`}
                aria-current={isActive ? 'step' : undefined}
                className="flex min-w-0 flex-1 items-start gap-3 md:block"
              >
                <div className="flex shrink-0 flex-col items-center md:flex-row md:items-center">
                  <div
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-200 md:size-10',
                      isActive || isCompleted
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-hairline-strong bg-surface-2 text-ink-tertiary',
                      'motion-reduce:transition-none',
                    )}
                  >
                    <AnimatePresence initial={false} mode="wait">
                      {isCompleted ? (
                        <m.span
                          key="completed"
                          aria-hidden="true"
                          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                          transition={shouldReduceMotion ? { duration: 0 } : STEP_TRANSITION}
                        >
                          <Check size={16} strokeWidth={2.5} />
                        </m.span>
                      ) : (
                        <m.span
                          key="pending"
                          aria-hidden={step.icon ? true : undefined}
                          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                          transition={shouldReduceMotion ? { duration: 0 } : STEP_TRANSITION}
                        >
                          {step.icon ?? index + 1}
                        </m.span>
                      )}
                    </AnimatePresence>
                  </div>

                  {hasNextStep && (
                    <div
                      aria-hidden="true"
                      className="my-1 h-7 w-0.5 overflow-hidden rounded-full bg-surface-4 md:mx-2 md:my-0 md:h-0.5 md:min-w-6 md:flex-1"
                    >
                      <m.div
                        animate={{
                          height: isCompleted ? '100%' : '0%',
                          width: isCompleted ? '100%' : '0%',
                        }}
                        className="h-full w-full origin-top-left bg-primary md:origin-left"
                        transition={shouldReduceMotion ? { duration: 0 } : LINE_TRANSITION}
                      />
                    </div>
                  )}
                </div>

                <div className="min-w-0 pb-5 md:mt-2 md:pr-3 md:pb-0">
                  <p className={cn(
                    'text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none',
                    getStepLabelClassName(isActive, isCompleted),
                  )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="mt-0.5 text-[11px] leading-4 text-ink-tertiary">
                      {step.description}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </LazyMotion>
    </MotionConfig>
  );
}
