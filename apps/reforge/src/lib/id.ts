/**
 * Shared unique-id generator for session and milestone ids.
 *
 * Centralized so storage migration and the session hook mint ids the same way.
 * `crypto.randomUUID` is available in browsers (in a secure context: https or
 * localhost) and in Node 22, so it also works under Vitest's node environment.
 */
export function uid(): string {
  return crypto.randomUUID();
}
