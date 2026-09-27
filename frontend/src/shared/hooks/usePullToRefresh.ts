import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

type PullToRefreshPhase = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'success' | 'error';

interface UsePullToRefreshOptions {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  resetKey: string;
  onRefresh: () => Promise<unknown>;
}

const PULL_THRESHOLD = 72;
const INDICATOR_THRESHOLD = 14;
const INTERACTIVE_TARGET_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[role="dialog"]',
  '[aria-modal="true"]',
  '[contenteditable="true"]',
  '[data-slot="dialog-content"]',
  '[data-slot="sheet-content"]',
  '[data-slot="popover-popup"]',
  '[data-slot="dropdown-menu-content"]',
].join(',');

function isElement(target: EventTarget | null): target is Element {
  return typeof Element !== 'undefined' && target instanceof Element;
}

function hasScrollableAncestor(target: Element | null, container: HTMLElement): boolean {
  let current = target?.parentElement ?? null;

  while (current && current !== container) {
    const { overflowY } = window.getComputedStyle(current);
    const canScrollVertically = /(auto|scroll|overlay)/.test(overflowY)
      && current.scrollHeight > current.clientHeight;

    if (canScrollVertically) return true;
    current = current.parentElement;
  }

  return false;
}

export function usePullToRefresh({
  containerRef,
  enabled,
  resetKey,
  onRefresh,
}: UsePullToRefreshOptions) {
  const [phase, setPhase] = useState<PullToRefreshPhase>('idle');
  const onRefreshRef = useRef(onRefresh);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const isRefreshingRef = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    startPointRef.current = null;
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setPhase('refreshing');

    try {
      await onRefreshRef.current();
      setPhase('success');
      successTimerRef.current = setTimeout(() => setPhase('idle'), 1400);
    } catch {
      setPhase('error');
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    startPointRef.current = null;
    if (!isRefreshingRef.current) setPhase('idle');
  }, [enabled, resetKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return undefined;

    const clearPull = () => {
      startPointRef.current = null;
      setPhase((current) => current === 'pulling' || current === 'ready' ? 'idle' : current);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (isRefreshingRef.current || event.touches.length !== 1 || container.scrollTop > 1) {
        startPointRef.current = null;
        return;
      }

      const target = isElement(event.target) ? event.target : null;
      if (
        target?.closest(INTERACTIVE_TARGET_SELECTOR)
        || hasScrollableAncestor(target, container)
        || container.ownerDocument.querySelector('[aria-modal="true"]')
      ) {
        startPointRef.current = null;
        return;
      }

      const touch = event.touches[0];
      startPointRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const start = startPointRef.current;
      if (!start) return;
      if (event.touches.length !== 1) {
        clearPull();
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY) * 0.8) {
        clearPull();
        return;
      }

      if (deltaY >= PULL_THRESHOLD) setPhase('ready');
      else if (deltaY >= INDICATOR_THRESHOLD) setPhase('pulling');
      else setPhase('idle');
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const start = startPointRef.current;
      startPointRef.current = null;
      if (!start || isRefreshingRef.current) return;

      const touch = event.changedTouches[0];
      if (!touch) {
        setPhase('idle');
        return;
      }

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (deltaY >= PULL_THRESHOLD && Math.abs(deltaX) <= Math.abs(deltaY) * 0.8) {
        void refresh();
      } else {
        setPhase('idle');
      }
    };

    const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };
    container.addEventListener('touchstart', handleTouchStart, listenerOptions);
    container.addEventListener('touchmove', handleTouchMove, listenerOptions);
    container.addEventListener('touchend', handleTouchEnd, listenerOptions);
    container.addEventListener('touchcancel', clearPull, listenerOptions);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart, true);
      container.removeEventListener('touchmove', handleTouchMove, true);
      container.removeEventListener('touchend', handleTouchEnd, true);
      container.removeEventListener('touchcancel', clearPull, true);
    };
  }, [containerRef, enabled, refresh, resetKey]);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  return { phase, refresh };
}
