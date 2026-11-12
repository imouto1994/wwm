import { createHash, timingSafeEqual } from 'node:crypto';

export const HOST_PIN_HEADER = 'x-host-pin';

/**
 * True when the request carries the host PIN. Both values are hashed first so
 * the comparison is constant-time regardless of length. With no PIN
 * configured, nobody is a host: writes fail closed.
 */
export function isHostRequest(request: Request, hostPin: string | undefined): boolean {
  const provided = request.headers.get(HOST_PIN_HEADER);
  if (!hostPin || !provided) return false;
  const expected = createHash('sha256').update(hostPin).digest();
  const actual = createHash('sha256').update(provided).digest();
  return timingSafeEqual(expected, actual);
}
