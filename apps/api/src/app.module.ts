import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { GradingModule } from './grading/grading.module';
import { AuthModule } from './auth/auth.module';
import { ClassesModule } from './classes/classes.module';
import { StudentsModule } from './students/students.module';
import { TestsModule } from './tests/tests.module';
import { AttendanceModule } from './attendance/attendance.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EventsModule } from './events/events.module';
import { ReportsModule } from './reports/reports.module';
import { CopilotModule } from './copilot/copilot.module';
import { ScheduleModule } from './schedule/schedule.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    GradingModule,
    AuthModule,
    ClassesModule,
    StudentsModule,
    TestsModule,
    AttendanceModule,
    DashboardModule,
    EventsModule,
    ReportsModule,
    CopilotModule,
    ScheduleModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    /**
     * Register JwtAuthGuard globally so every route is protected by default.
     * Routes that must be public (auth, health check) use @Public() to opt out.
     * This must be in AppModule (not AuthModule) so the Reflector DI token
     * resolves correctly before route metadata is read.
     */
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
