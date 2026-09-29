import { normalizeBdPhone } from './register.dto';

describe('normalizeBdPhone', () => {
  it.each([
    ['01712345678', '+8801712345678'],
    ['8801712345678', '+8801712345678'],
    ['+8801712345678', '+8801712345678'],
    ['01712-345678', '+8801712345678'],
    ['017 1234 5678', '+8801712345678'],
    ['(017)12345678', '+8801712345678'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeBdPhone(input)).toBe(expected);
  });

  it.each([
    // 012 is not a live operator prefix — must not be coerced into E.164.
    ['01212345678', '01212345678'],
    ['+14155551234', '+14155551234'],
    ['0171234567', '0171234567'], // one digit short
  ])('leaves %s unchanged for the validator to reject', (input, expected) => {
    expect(normalizeBdPhone(input)).toBe(expected);
  });

  it('passes non-strings through untouched', () => {
    expect(normalizeBdPhone(undefined)).toBeUndefined();
    expect(normalizeBdPhone(42)).toBe(42);
  });
});
