import { useEffect, useRef, useState } from "react";

export function useActivationCounter(active: boolean): number {
  const [count, setCount] = useState(0);
  const prevActiveRef = useRef<boolean | null>(null);

  useEffect(() => {
    const prevActive = prevActiveRef.current;
    const shouldIncrement = active && prevActive !== true;

    if (shouldIncrement) {
      setCount((prev) => prev + 1);
    }

    prevActiveRef.current = active;
  }, [active]);

  return count;
}
