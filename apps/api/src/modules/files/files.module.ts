import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * Object storage — architecture §3 `files`.
 *
 * Global because both admin document upload (Weeks 3–4) and student image
 * questions (Weeks 7–8) need it, and threading it through two module trees
 * buys nothing.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class FilesModule {}
