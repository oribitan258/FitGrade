import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { GradingModule } from './grading/grading.module';
import { AuthModule } from './auth/auth.module';
import { ClassesModule } from './classes/classes.module';
import { StudentsModule } from './students/students.module';

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
    // Remaining feature modules added in subsequent phases:
    // ResultsModule, AttendanceModule, ExportsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
