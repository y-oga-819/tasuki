import { useCallback, useState } from "react";

/** Race a promise against a timeout. */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * Hook for async actions with built-in loading/error state and timeout.
 *
 * @param action  The async function to execute.
 * @param options Optional config (timeout defaults to 10 000 ms).
 */
export function useAsyncAction<T>(
  action: () => Promise<T>,
  options?: { timeout?: number },
): {
  execute: () => Promise<T | undefined>;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
} {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await withTimeout(action(), options?.timeout ?? 10_000);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return undefined;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, options?.timeout]);

  return { execute, isLoading, error, reset: () => setError(null) };
}
