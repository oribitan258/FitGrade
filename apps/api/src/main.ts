import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger, ClassSerializerInterceptor } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // ─── Global prefix ────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ─── Cookie parser ────────────────────────────────────────
  app.use(cookieParser());

  // ─── CORS ─────────────────────────────────────────────────
  app.enableCors({
    origin: process.env['WEB_URL'] ?? 'http://localhost:3000',
    credentials: true,
  });

  // ─── Global serializer (applies @Exclude() on every response) ────────────
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ─── Global validation pipe ───────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Swagger ──────────────────────────────────────────────
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('FitGrade API')
      .setDescription('REST API for the FitGrade PE grading system')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger docs available at /api/docs');
  }

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
  logger.log(`API running on http://localhost:${port}/api`);
}

bootstrap();
