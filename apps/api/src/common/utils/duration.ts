/**
 * Parses a JWT-style duration ("15m", "30d", "900") into seconds.
 *
 * Exists because the same TTL string configures both the JWT `expiresIn` and
 * the Redis key expiry, and those two drifting apart is how you get refresh
 * tokens that verify fine but have no server-side record.
 */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d|w)?$/i.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid duration: "${value}". Expected forms: 900, 15m, 24h, 30d, 2w`);
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
    w: 60 * 60 * 24 * 7,
  };

  return amount * multipliers[unit];
}
