import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { StudentsModule } from '../students/students.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ReportsModule } from '../reports/reports.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { TestsModule } from '../tests/tests.module';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';
import { CopilotToolExecutor } from './copilot-tool-executor';
import { ConversationHistoryStore } from './stores/conversation-history.store';
import { PendingActionStore } from './stores/pending-action.store';

/**
 * CopilotModule — FitGrade AI Copilot backend.
 *
 * Imports domain modules to give CopilotToolExecutor access to their exported
 * services for both READ tool execution and WRITE tool snapshot/revert logic.
 *
 * PrismaModule is @Global() and does not need to be imported explicitly.
 */
@Module({
  imports: [
    ClassesModule,   // exports ClassesService
    StudentsModule,  // exports StudentsService
    DashboardModule, // exports DashboardService
    ReportsModule,   // exports ReportsService
    AttendanceModule, // exports AttendanceService
    TestsModule,     // exports TestsService
  ],
  controllers: [CopilotController],
  providers: [
    CopilotService,
    CopilotToolExecutor,
    ConversationHistoryStore,
    PendingActionStore,
  ],
})
export class CopilotModule {}
