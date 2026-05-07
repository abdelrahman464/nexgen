import type { Express } from 'express';
import { join } from 'path';

const i18n = require('i18n');
const morgan = require('morgan');
const localeMiddleware = require('../../middlewares/localeMiddleware');

export function configureLegacySupport(expressApp: Express) {
  const mountRoutes = require('../../routes');
  const globalError = require('../../middlewares/errorMiddleware');

  i18n.configure({
    locales: [process.env.FIRST_LANGUAGE || 'ar', process.env.SECOND_LANGUAGE || 'en'],
    directory: join(process.cwd(), 'locales'),
    defaultLocale: process.env.FIRST_LANGUAGE || 'ar',
    objectNotation: true,
    header: 'Accept-Language',
  });

  expressApp.use(i18n.init);
  expressApp.use(localeMiddleware);

  if (process.env.NODE_ENV === 'development') {
    expressApp.use(morgan('dev'));
  }

  mountRoutes(expressApp);
  expressApp.use(globalError);
}
