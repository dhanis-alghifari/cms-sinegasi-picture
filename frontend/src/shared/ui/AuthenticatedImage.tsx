import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { imageService } from '@/shared/api/image.service';

interface AuthenticatedImageProps {
  endpoint: string;
  cacheScope: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
}

export function AuthenticatedImage({ endpoint, cacheScope, alt, className, fallback }: AuthenticatedImageProps) {
  const imageRef = useRef<HTMLSpanElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(() => typeof IntersectionObserver === 'undefined');
  const { data } = useQuery({
    queryKey: ['authenticated-image', cacheScope, endpoint],
    queryFn: () => imageService.getAuthenticatedImage(endpoint),
    enabled: isNearViewport && Boolean(cacheScope),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const element = imageRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (data?.kind === 'blob') return imageService.retainObjectUrl(data.url);
    return undefined;
  }, [data]);

  const src = data?.url ?? null;
  return (
    <span ref={imageRef} className={`relative block overflow-hidden ${className ?? ''}`}>
      {src ? <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : fallback}
    </span>
  );
}
