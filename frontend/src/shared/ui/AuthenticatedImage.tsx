import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePrivateImage } from '@/shared/hooks/usePrivateImage';

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
  const { src } = usePrivateImage(endpoint, isNearViewport && Boolean(cacheScope));

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

  return (
    <span ref={imageRef} className={`relative block overflow-hidden ${className ?? ''}`}>
      {src ? <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : fallback}
    </span>
  );
}
