import { Module } from '@nestjs/common';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

/**
 * Student profile and academic setup — doc 04 "Student".
 *
 * Owns `GET/PATCH /api/v1/me` and subject selection.
 */
@Module({
  imports: [CurriculumModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
