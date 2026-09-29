import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('verifies a password against its own hash', async () => {
    const hash = await service.hash('strongpass123');
    await expect(service.verify(hash, 'strongpass123')).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('strongpass123');
    await expect(service.verify(hash, 'strongpass124')).resolves.toBe(false);
  });

  it('produces a different hash each time (salted)', async () => {
    const [a, b] = await Promise.all([service.hash('same'), service.hash('same')]);
    expect(a).not.toBe(b);
  });

  it('treats a malformed stored hash as a failed verification, not an error', async () => {
    await expect(service.verify('not-a-hash', 'anything')).resolves.toBe(false);
  });

  it('does not ask for a rehash of a hash it just wrote', async () => {
    const hash = await service.hash('strongpass123');
    expect(service.needsRehash(hash)).toBe(false);
  });
});
