import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { GradingModule } from './grading/grading.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    GradingModule,
    // Remaining feature modules added in subsequent phases:
    // AuthModule, UsersModule, ClassesModule, StudentsModule,
    // ResultsModule, AttendanceModule, ExportsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
