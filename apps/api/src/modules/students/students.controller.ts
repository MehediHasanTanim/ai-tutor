import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MeResponse } from '@ai-tutor/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { StudentsService } from './students.service';

@ApiTags('student')
@Controller('me')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @ApiOperation({
    summary: 'The signed-in student',
    description:
      'A null `profile` means academic setup has not been completed; the app ' +
      'routes to onboarding on that.',
  })
  getMe(@CurrentUser('userId') userId: string): Promise<MeResponse> {
    return this.students.getMe(userId);
  }

  @Patch()
  @ApiOperation({
    summary: 'Create or update the profile',
    description:
      'Serves both first-time academic setup and later edits. `subject_ids` ' +
      'replaces the whole selection rather than merging.',
  })
  updateMe(@CurrentUser('userId') userId: string, @Body() dto: UpdateMeDto): Promise<MeResponse> {
    return this.students.updateMe(userId, dto);
  }
}
