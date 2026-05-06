import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: Buffer;
    locale?: string;
    user?: any;
    filterObj?: Record<string, any>;
  }
}
