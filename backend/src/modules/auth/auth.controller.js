import { env } from '../../config/env.js';
import { query } from '../../config/db.js';
import { ROLES } from '../../constants/roles.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { badRequest, forbidden, unauthorized } from '../../utils/http-error.js';
import { hashPassword, verifyPassword } from '../../utils/passwords.js';
import { signAccessToken } from '../../utils/tokens.js';

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role
  };
}

async function resolveRegistrationRole(requestedRole) {
  if (!requestedRole || requestedRole === ROLES.CUSTOMER) {
    return ROLES.CUSTOMER;
  }

  if (requestedRole !== ROLES.ADMIN) {
    throw forbidden('Only customer registration is public.');
  }

  if (!env.allowAdminBootstrap) {
    throw forbidden('Admin bootstrap is disabled.');
  }

  const admins = await query('SELECT id FROM users WHERE role = :role LIMIT 1', { role: ROLES.ADMIN });

  if (admins.length > 0) {
    throw forbidden('An admin account already exists.');
  }

  return ROLES.ADMIN;
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role: requestedRole } = req.validated.body;
  const existing = await query('SELECT id FROM users WHERE email = :email LIMIT 1', { email });

  if (existing.length > 0) {
    throw badRequest('Email is already registered.');
  }

  const role = await resolveRegistrationRole(requestedRole);
  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO users (name, email, phone, password_hash, role)
     VALUES (:name, :email, :phone, :passwordHash, :role)`,
    { name, email, phone, passwordHash, role }
  );

  const user = { id: result.insertId, name, email, phone, role };
  const token = signAccessToken(user);

  res.status(201).json({
    token,
    user: serializeUser(user)
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const users = await query(
    `SELECT id, name, email, phone, password_hash, role, is_active
     FROM users
     WHERE email = :email
     LIMIT 1`,
    { email }
  );
  const user = users[0];

  if (!user || !user.is_active) {
    throw unauthorized('Invalid email or password.');
  }

  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    throw unauthorized('Invalid email or password.');
  }

  const token = signAccessToken(user);

  res.json({
    token,
    user: serializeUser(user)
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

