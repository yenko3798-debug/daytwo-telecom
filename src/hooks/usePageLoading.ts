import { useCallback, useEffect, useRef, useState } from "react";

export function usePageLoading(duration = 520) {
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    clear();
    setLoading(false);
  }, [clear]);

  const begin = useCallback(
    (nextDuration?: number) => {
      clear();
      setLoading(true);
      const timeout = window.setTimeout(finish, nextDuration ?? duration);
      timerRef.current = timeout;
    },
    [clear, duration, finish],
  );

  useEffect(() => {
    begin(Math.min(duration, 200));
    rafRef.current = window.requestAnimationFrame(finish);
    return clear;
  }, [begin, clear, duration, finish]);

  return { loading, begin, setLoading };
}
