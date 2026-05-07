import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { asyncHandler } from '../utils/async-handler.js';
import { forbidden, unauthorized } from '../utils/http-error.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization');

  if (!header?.startsWith('Bearer ')) {
    throw unauthorized();
  }

  const token = header.slice('Bearer '.length);
  let payload;

  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch {
    throw unauthorized('Invalid or expired token.');
  }

  const users = await query(
    `SELECT id, name, email, phone, role, is_active
     FROM users
     WHERE id = :id
     LIMIT 1`,
    { id: payload.sub }
  );

  const user = users[0];

  if (!user || !user.is_active) {
    throw unauthorized('User account is inactive or unavailable.');
  }

  req.user = user;
  next();
});

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(forbidden());
    }

    return next();
  };
}
