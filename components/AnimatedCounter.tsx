'use client';

import { useEffect, useRef, useState } from 'react';

import { formatAmount } from '@/lib/utils';

/**
 * Counts up to the given amount on mount.
 *
 * A tiny local implementation instead of `react-countup`: the library only
 * renders its start value in this app's setup, and this keeps the formatting
 * identical to the rest of the UI (`formatAmount`).
 */
const AnimatedCounter = ({ amount }: { amount: number }) => {
  const target = Number.isFinite(Number(amount)) ? Number(amount) : 0;

  const [value, setValue] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const duration = 900;
    const startedAt = performance.now();

    // requestAnimationFrame is throttled (or paused) in background tabs, so
    // always settle on the final value even when the animation cannot run.
    const settle = window.setTimeout(() => setValue(target), duration + 100);

    if (typeof document !== 'undefined' && document.hidden) {
      setValue(target);
      return () => window.clearTimeout(settle);
    }

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      // ease-out so the counter settles instead of stopping abruptly
      const eased = 1 - Math.pow(1 - progress, 3);

      setValue(target * eased);

      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };

    frame.current = requestAnimationFrame(tick);

    return () => {
      window.clearTimeout(settle);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target]);

  return <div className="w-full">{formatAmount(value)}</div>;
};

export default AnimatedCounter;
