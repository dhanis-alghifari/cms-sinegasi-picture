import { useEffect, type ImgHTMLAttributes } from 'react';
import { usePrivateImage } from '@/shared/hooks/usePrivateImage';
import { isLocalImagePreview } from '@/shared/api/privateMedia';

interface PrivateImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null;
  enabled?: boolean;
  onUnavailable?: () => void;
  allowLocalPreview?: boolean;
}

export function PrivateImage({ src, enabled = true, onUnavailable, allowLocalPreview = false, ...props }: PrivateImageProps) {
  const image = usePrivateImage(src, enabled);
  useEffect(() => { if (image.failed) onUnavailable?.(); }, [image.failed, onUnavailable]);
  const resolved = enabled && allowLocalPreview && src && isLocalImagePreview(src) ? src : image.src;
  return resolved ? <img {...props} src={resolved} referrerPolicy="no-referrer" /> : <span role="status" className={props.className}>Foto belum tersedia</span>;
}
