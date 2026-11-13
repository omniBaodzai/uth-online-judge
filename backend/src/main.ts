
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { REFRESH_COOKIE_NAME } from './auth/auth.controller.js';
import { AvatarStorageService } from './auth/avatar-storage.service.js';
import { ALLOWED_CORS_HEADERS, getAllowedFrontendOrigins } from './cors-origins.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  // Ảnh đại diện là tài nguyên công khai; nosniff ngăn trình duyệt đoán sai kiểu nội dung.
  app.useStaticAssets(app.get(AvatarStorageService).root, {
    prefix: '/uploads/',
    index: false,
    dotfiles: 'deny',
    maxAge: '1d',
    setHeaders: (response) => {
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });
  app.enableCors({
    origin: getAllowedFrontendOrigins(process.env.FRONTEND_ORIGINS),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ALLOWED_CORS_HEADERS,
    exposedHeaders: ['Retry-After'],
  });

  // Validate dữ liệu đầu vào của các request
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Cấu hình tài liệu API bằng Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('API UTH Online Judge')
    .setDescription('Tài liệu các API của hệ thống UTH Online Judge.')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth(REFRESH_COOKIE_NAME, { type: 'apiKey', in: 'cookie' })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
