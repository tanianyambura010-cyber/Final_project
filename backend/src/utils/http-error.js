export class HttpError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function badRequest(message, details) {
  return new HttpError(400, message, details);
}

export function unauthorized(message = 'Authentication is required.') {
  return new HttpError(401, message);
}

export function forbidden(message = 'You do not have permission to perform this action.') {
  return new HttpError(403, message);
}

export function notFound(message = 'Resource not found.') {
  return new HttpError(404, message);
}

