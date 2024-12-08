const localeMiddleware = (req, res, next) => {
  const acceptLanguage = req.headers["accept-language"];

  if (
    req.query.lang &&
    [process.env.FIRST_LANGUAGE, process.env.SECOND_LANGUAGE].includes(
      req.query.lang
    )
  ) {
    req.setLocale(req.query.lang);
  } else if (acceptLanguage) {
    const headerLang = acceptLanguage.split(",")[0];
    if (
      [process.env.FIRST_LANGUAGE, process.env.SECOND_LANGUAGE].includes(
        headerLang
      )
    ) {
      req.setLocale(headerLang);
    }
  }

  req.locale = req.getLocale();
  next();
};

module.exports = localeMiddleware;
