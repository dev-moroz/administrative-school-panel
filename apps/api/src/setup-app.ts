import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

// Shared by main.ts and the e2e tests, so the tests run against the real pipeline.
export function setupApp(app: INestApplication) {
  app.use(helmet());
  app.use(cookieParser());
  // whitelist: unknown fields are stripped; forbidNonWhitelisted: they are rejected with 400 instead.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
