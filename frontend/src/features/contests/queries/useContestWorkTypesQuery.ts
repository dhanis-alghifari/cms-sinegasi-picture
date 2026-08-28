import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { contestsService } from '../services/contests.service';

const FALLBACK_WORK_TYPES = [
  { code: 'short_film' as const, label: 'Film Pendek' },
  { code: 'documentary' as const, label: 'Dokumenter' },
  { code: 'photography' as const, label: 'Fotografi' },
  { code: 'animation' as const, label: 'Animasi' },
  { code: 'commercial' as const, label: 'Iklan / Komersial' },
  { code: 'music_video' as const, label: 'Video Musik' },
  { code: 'experimental' as const, label: 'Eksperimental' },
  { code: 'other' as const, label: 'Lainnya' },
];

export function useContestWorkTypesQuery(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.CONTEST_WORK_TYPES,
    queryFn: () => contestsService.getContestWorkTypes(),
    enabled,
    placeholderData: FALLBACK_WORK_TYPES,
    staleTime: 5 * 60_000,
  });
}
