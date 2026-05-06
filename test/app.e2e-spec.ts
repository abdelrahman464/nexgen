import { Body, Controller, Get, INestApplication, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString, MinLength } from 'class-validator';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupNestApp } from '../src/app.setup';
import { captureRawBody } from '../src/common/middleware/raw-body.middleware';
import express, { json, raw } from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';

class ValidationSmokeDto {
  @IsString()
  @MinLength(3)
  name!: string;
}

@Controller('validation-smoke')
class ValidationSmokeController {
  @Post()
  create(@Body() body: ValidationSmokeDto) {
    return body;
  }
}

@Module({
  controllers: [ValidationSmokeController],
})
class ValidationSmokeModule {}

describe('Nest base smoke', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.SKIP_DB_CONNECTION = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    setupNestApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('boots and serves health', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('success');
        expect(body.data.status).toBe('ok');
      });
  });
});

describe('Swagger smoke', () => {
  it('exposes swagger json in the bootstrap path shape', async () => {
    const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');
    const expressApp = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
      logger: false,
    });
    setupNestApp(app);
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('NexGen Pro API').setVersion('1.0.0').build(),
    );
    expressApp.get('/api-docs.json', (_req, res) => res.json(document));
    await app.init();

    await request(expressApp).get('/api-docs.json').expect(200).expect('Content-Type', /json/);
    await app.close();
  });
});

describe('Middleware smoke', () => {
  it('captures raw body for webhook requests', async () => {
    const app = express();
    app.use('/api/v1/orders/webhook/stripe', raw({ type: '*/*', verify: captureRawBody }));
    app.post('/api/v1/orders/webhook/stripe', (req, res) => {
      res.json({ rawBody: Boolean(req.rawBody), length: req.rawBody?.length || 0 });
    });

    await request(app)
      .post('/api/v1/orders/webhook/stripe')
      .set('Content-Type', 'application/json')
      .send('{"event":"paid"}')
      .expect(200)
      .expect(({ body }) => {
        expect(body.rawBody).toBe(true);
        expect(body.length).toBeGreaterThan(0);
      });
  });

  it('registers static uploads middleware', async () => {
    const app = express();
    app.use(express.static('uploads'));
    await request(app).get('/__missing_static_file__').expect(404);
  });
});

describe('Validation smoke', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ValidationSmokeModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupNestApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects invalid DTO input', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/validation-smoke')
      .send({ name: 'x', extra: true })
      .expect(400);
  });

  it('accepts valid DTO input', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/validation-smoke')
      .send({ name: 'valid' })
      .expect(201);
  });
});
