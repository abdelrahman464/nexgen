import 'reflect-metadata';
import compression from 'compression';
import express, { json, raw, urlencoded } from 'express';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { setupNestApp } from './app.setup';
import { configureLegacySupport } from './legacy/legacy-support';
import { captureRawBody, isWebhookPath } from './common/middleware/raw-body.middleware';

async function bootstrap() {
  const expressApp = express();

  expressApp.use(
    ['/api/v1/orders/webhook/stripe', '/api/v1/orders/webhook/plisio', '/api/v1/orders/webhook/lahza'],
    raw({
      type: '*/*',
      verify: captureRawBody,
    }),
  );
  expressApp.use((req, res, next) => {
    if (isWebhookPath(req.path)) return next();
    return json({ verify: captureRawBody })(req, res, next);
  });
  expressApp.use(urlencoded({ extended: true, limit: '1000kb' }));
  expressApp.use(express.static(join(process.cwd(), 'uploads')));

  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  setupNestApp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NexGen Pro API')
    .setDescription('API documentation for NexGen Pro platform')
    .setVersion('1.0.0')
    .addServer(process.env.BASE_URL || 'http://localhost:8000/api/v1', 'Configured server')
    .addServer('/api/v1', 'Relative URL')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'NexGen Pro API Documentation',
  });
  expressApp.get('/api-docs.json', (_req, res) => res.json(swaggerDocument));

  await app.init();
  configureLegacySupport(expressApp);

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`app running on ${port}`);
}

void bootstrap();
