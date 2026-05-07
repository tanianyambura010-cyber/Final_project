import { badRequest } from '../utils/http-error.js';

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!result.success) {
      return next(badRequest('Request validation failed.', result.error.flatten()));
    }

    req.validated = result.data;
    return next();
  };
}

