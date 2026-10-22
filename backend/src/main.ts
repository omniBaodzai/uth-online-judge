
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { REFRESH_COOKIE_NAME } from './auth/auth.controller.js';
import { AvatarStorageService } from './auth/avatar-storage.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
  const allowedOrigins = (process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
    .setTitle('UTH Online Judge API')
    .setDescription('API documentation for UTH Online Judge')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth(REFRESH_COOKIE_NAME, { type: 'apiKey', in: 'cookie' })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
