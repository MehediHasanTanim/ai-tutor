import { Module } from '@nestjs/common';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';

/**
 * Curriculum module — the read surface over Curriculum → Subject → Chapter →
 * Topic (doc 04 §1).
 *
 * Architecture §3 lists `subjects` and `chapters` as separate modules; those
 * exist as empty shells and re-export this service rather than duplicating
 * queries over the same four tables. Admin writes live in the admin module,
 * which is where RBAC is enforced.
 */
@Module({
  controllers: [CurriculumController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
