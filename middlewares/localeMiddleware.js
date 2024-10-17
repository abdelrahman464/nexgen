const localeMiddleware = (req, res, next) => {
  const acceptLanguage = req.headers['accept-language'];

  if (req.query.lang && ['en', 'ar'].includes(req.query.lang)) {
    req.setLocale(req.query.lang);
  } else if (acceptLanguage) {
    const headerLang = acceptLanguage.split(',')[0];
    if (['en', 'ar'].includes(headerLang)) {
      req.setLocale(headerLang);
    }
  }

  req.locale = req.getLocale();
  next();
};

module.exports = localeMiddleware;
