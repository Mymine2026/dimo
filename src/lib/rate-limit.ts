// Minimal in-memory brute-force guard for the login (single app instance).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

const failures = new Map<string, number[]>();

function recent(key: string): number[] {
  const now = Date.now();
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list;
}

export function isLockedOut(key: string): boolean {
  return recent(key).length >= MAX_FAILURES;
}

export function recordFailure(key: string): void {
  failures.set(key, [...recent(key), Date.now()]);
}

export function clearFailures(key: string): void {
  failures.delete(key);
}
