import { useCallback, useEffect, useRef, useState } from "react";

export function usePageLoading() {
  const [loading, setLoading] = useState(true);
  const rafRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      setLoading(false);
    });
    return clear;
  }, [clear]);

  const begin = useCallback(() => {
    clear();
    setLoading(true);
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      setLoading(false);
    });
  }, [clear]);

  return { loading, begin, setLoading };
}
