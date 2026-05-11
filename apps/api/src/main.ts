import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger, ClassSerializerInterceptor } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // ─── Global prefix ────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ─── Security headers (Helmet) ────────────────────────────
  //
  // Must be applied BEFORE any route handler so every response carries these
  // headers, including error responses from the exception filter.
  //
  // CSP allows:
  //   • self — for API JSON responses (no embedded scripts/styles)
  //   • google accounts — for OAuth redirects
  //   • none on frame-src / object-src — prevents clickjacking & plugin embeds
  //
  // crossOriginEmbedderPolicy is left at the default (require-corp) only for
  // pure API responses; the web frontend configures its own Helmet via Next.js.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc:      ["'self'"],
          scriptSrc:       ["'self'"],
          styleSrc:        ["'self'"],
          imgSrc:          ["'self'", 'data:', 'https://lh3.googleusercontent.com'],
          connectSrc:      ["'self'"],
          fontSrc:         ["'self'"],
          objectSrc:       ["'none'"],
          frameSrc:        ["'none'"],
          frameAncestors:  ["'none'"],   // X-Frame-Options: DENY equivalent
          formAction:      ["'self'"],
          upgradeInsecureRequests: process.env['NODE_ENV'] === 'production' ? [] : null,
        },
      },
      // Strict-Transport-Security — 1 year, include subdomains, preload-eligible
      hsts: process.env['NODE_ENV'] === 'production'
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      // X-Content-Type-Options: nosniff — prevents MIME-sniffing of JSON as HTML
      noSniff: true,
      // X-Frame-Options: DENY — belt-and-suspenders alongside frameAncestors CSP
      frameguard: { action: 'deny' },
      // Referrer-Policy — don't leak path in Referer header
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // X-DNS-Prefetch-Control — disable speculative DNS lookups
      dnsPrefetchControl: { allow: false },
      // Remove X-Powered-By: Express — obscures backend stack
      hidePoweredBy: true,
      // Cross-Origin-Resource-Policy: same-origin
      crossOriginResourcePolicy: { policy: 'same-origin' },
      // Permissions-Policy — disable camera/mic/geolocation (not needed)
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    }),
  );

  // ─── Cookie parser ────────────────────────────────────────
  app.use(cookieParser());

  // ─── CORS ─────────────────────────────────────────────────
  app.enableCors({
    origin: process.env['WEB_URL'] ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ─── Global exception filter ──────────────────────────────────────────────
  // Must be registered before other pipes/interceptors so it catches every throw.
  app.useGlobalFilters(new AllExceptionsFilter());

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
