/**
 * Creates a throttled version of a function that collects calls within a
 * time window and only executes with the latest arguments once the window
 * elapses.  This is a "trailing-edge" throttle: the first call starts the
 * timer and the function fires at the end of the window with whatever the
 * most recent arguments were.
 */
export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  return ((...args: Parameters<T>) => {
    lastArgs = args;
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        if (lastArgs) fn(...lastArgs);
      }, ms);
    }
  }) as T;
}
