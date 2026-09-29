import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Password hashing — argon2id, per doc 07 Weeks 1–2.
 *
 * Parameters are the OWASP-recommended baseline. They are pinned here rather
 * than left to library defaults so a dependency bump cannot silently weaken
 * every hash written afterwards.
 */
@Injectable()
export class PasswordService {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  };

  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // A malformed stored hash is a failed verification, not a 500.
      return false;
    }
  }

  /** True when the stored hash was produced with weaker parameters than current. */
  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, this.options);
  }
}
