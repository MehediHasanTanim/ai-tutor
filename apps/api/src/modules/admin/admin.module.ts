import { Module } from '@nestjs/common';
import { RagModule } from '../rag/rag.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * Admin module — document upload, processing status, chunk inspection.
 *
 * RBAC-guarded at the controller. Storage comes from the global FilesModule.
 */
@Module({
  imports: [RagModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
