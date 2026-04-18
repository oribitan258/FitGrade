import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { ScheduleModule } from './schedule/schedule.module';
import { ComparisonModule } from './comparison/comparison.module';
import { SettingsModule } from './settings/settings.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    /**
     * Global rate-limiting via @nestjs/throttler.
     * Default (permissive) limit: 60 requests / 60 s — covers normal UI usage.
     * Auth endpoints override this with stricter limits via @Throttle() decorators.
     */
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000,
        limit: 60,
      },
    ]),
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
    ScheduleModule,
    ComparisonModule,
    SettingsModule,
    AuditLogModule,
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
    /**
     * Register RolesGuard globally as the second APP_GUARD.
     * Runs after JwtAuthGuard — by this point req.user is populated.
     * Routes decorated with @Roles('TEACHER') reject student JWTs with 403.
     */
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    /**
     * Register ThrottlerGuard globally as the third APP_GUARD.
     * Default limit is permissive (60 req / 60 s). Auth endpoints override
     * with stricter @Throttle() decorators to prevent brute-force attacks.
     */
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
