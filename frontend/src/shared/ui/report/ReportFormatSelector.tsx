import { RadioGroup } from '@/shared/ui/primitives/radio-group';
import type { ReportPrintFormat } from '@/shared/types/report';

interface ReportFormatSelectorProps {
  name: string;
  value: ReportPrintFormat;
  onValueChange: (value: ReportPrintFormat) => void;
  legend?: string;
  className?: string;
}

export function ReportFormatSelector({
  name,
  value,
  onValueChange,
  legend = 'Format laporan',
  className,
}: ReportFormatSelectorProps) {
  return (
    <RadioGroup
      name={name}
      legend={legend}
      value={value}
      options={[
        { value: 'a4', label: 'A4' },
        { value: 'presentation', label: '16:9' },
      ]}
      onValueChange={onValueChange}
      className={className}
    />
  );
}
