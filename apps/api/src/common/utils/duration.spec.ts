import { parseDurationToSeconds } from './duration';

describe('parseDurationToSeconds', () => {
  it.each([
    ['900', 900],
    ['30s', 30],
    ['15m', 900],
    ['24h', 86_400],
    ['30d', 2_592_000],
    ['2w', 1_209_600],
    [' 15m ', 900],
    ['15M', 900],
  ])('parses %s to %i seconds', (input, expected) => {
    expect(parseDurationToSeconds(input)).toBe(expected);
  });

  it.each(['', 'abc', '15x', '-5m', '1.5h', 'm15'])('rejects %p', (input) => {
    expect(() => parseDurationToSeconds(input)).toThrow(/Invalid duration/);
  });
});
