import type { Request, Response } from 'express';

const webhookPaths = new Set([
  '/api/v1/orders/webhook/stripe',
  '/api/v1/orders/webhook/plisio',
  '/api/v1/orders/webhook/lahza',
]);

export function isWebhookPath(path: string) {
  return webhookPaths.has(path);
}

export function captureRawBody(req: Request & { rawBody?: Buffer }, _res: Response, buffer: Buffer) {
  if (buffer?.length) {
    req.rawBody = Buffer.from(buffer);
  }
}
