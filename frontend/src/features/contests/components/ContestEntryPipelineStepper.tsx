import { Clock3, FilePenLine, Send, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';

import { AnimatedStepper, type AnimatedStepperStep } from '@/shared/ui/motion/animated-stepper';

import type { ContestEntryStatus } from '../types/contests.types';
import { getContestEntryStatusLabel } from '../utils/contestLabels';
import {
  CONTEST_PIPELINE_ORDER,
  getPipelineStepIndex,
} from '../utils/contestPipelineRules';

const PIPELINE_DESCRIPTIONS: Record<ContestEntryStatus, string> = {
  proses_submit: 'Siapkan karya dan data pengiriman.',
  sudah_terkirim: 'Bukti pengiriman sudah dicatat.',
  menunggu_pengumuman: 'Menunggu hasil resmi panitia.',
  selesai: 'Hasil dan bukti akhir sudah tersimpan.',
};

const PIPELINE_ICONS: Record<ContestEntryStatus, ReactNode> = {
  proses_submit: <FilePenLine size={15} strokeWidth={2} />,
  sudah_terkirim: <Send size={15} strokeWidth={2} />,
  menunggu_pengumuman: <Clock3 size={15} strokeWidth={2} />,
  selesai: <Trophy size={15} strokeWidth={2} />,
};

const PIPELINE_STEPS: readonly AnimatedStepperStep[] = CONTEST_PIPELINE_ORDER.map((status) => ({
  id: status,
  label: getContestEntryStatusLabel(status),
  description: PIPELINE_DESCRIPTIONS[status],
  icon: PIPELINE_ICONS[status],
}));

interface ContestEntryPipelineStepperProps {
  currentStatus: ContestEntryStatus;
}

export function ContestEntryPipelineStepper({
  currentStatus,
}: ContestEntryPipelineStepperProps) {
  return (
    <section className="space-y-3 rounded-xl border border-hairline bg-surface-1 p-4" aria-label="Progres pipeline karya">
      <div>
        <p className="text-xs font-semibold text-ink">Progres pipeline karya</p>
        <p className="mt-0.5 text-[11px] text-ink-tertiary">
          Tahapan berjalan berurutan sampai hasil akhir tercatat.
        </p>
      </div>
      <AnimatedStepper
        steps={PIPELINE_STEPS}
        currentStep={getPipelineStepIndex(currentStatus)}
        ariaLabel="Tahapan progres karya lomba"
      />
    </section>
  );
}
