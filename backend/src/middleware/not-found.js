import { notFound } from '../utils/http-error.js';

export function notFoundHandler(req, _res, next) {
  next(notFound(`Route ${req.method} ${req.originalUrl} was not found.`));
}

