import { query } from '../../config/db.js';
import { ROLES } from '../../constants/roles.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { badRequest, forbidden, notFound } from '../../utils/http-error.js';
import { hashPassword } from '../../utils/passwords.js';

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const listUsers = asyncHandler(async (req, res) => {
  const { role, active, search } = req.validated.query;
  const filters = [];
  const params = {};

  if (role) {
    filters.push('role = :role');
    params.role = role;
  }

  if (active) {
    filters.push('is_active = :isActive');
    params.isActive = active === 'true';
  }

  if (search) {
    filters.push('(name LIKE :search OR email LIKE :search OR phone LIKE :search)');
    params.search = `%${search}%`;
  }

  const rows = await query(
    `SELECT id, name, email, phone, role, is_active, created_at, updated_at
     FROM users
     ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
     ORDER BY created_at DESC`,
    params
  );

  res.json({ users: rows.map(mapUser) });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role } = req.validated.body;
  const existing = await query('SELECT id FROM users WHERE email = :email LIMIT 1', { email });

  if (existing[0]) {
    throw badRequest('Email is already registered.');
  }

  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO users (name, email, phone, password_hash, role)
     VALUES (:name, :email, :phone, :passwordHash, :role)`,
    { name, email, phone, passwordHash, role }
  );

  const rows = await query(
    `SELECT id, name, email, phone, role, is_active, created_at, updated_at
     FROM users
     WHERE id = :id
     LIMIT 1`,
    { id: result.insertId }
  );

  res.status(201).json({ user: mapUser(rows[0]) });
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { role } = req.validated.body;

  if (Number(id) === Number(req.user.id) && role !== ROLES.ADMIN) {
    throw forbidden('Admins cannot remove their own admin role.');
  }

  const existing = await query('SELECT id, role FROM users WHERE id = :id LIMIT 1', { id });

  if (!existing[0]) {
    throw notFound('User was not found.');
  }

  if (existing[0].role === ROLES.RIDER) {
    throw badRequest('Use the rider profile endpoints to manage rider accounts.');
  }

  await query('UPDATE users SET role = :role WHERE id = :id', { id, role });

  const rows = await query(
    `SELECT id, name, email, phone, role, is_active, created_at, updated_at
     FROM users
     WHERE id = :id
     LIMIT 1`,
    { id }
  );

  res.json({ user: mapUser(rows[0]) });
});

export const updateUserActive = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { isActive } = req.validated.body;

  if (Number(id) === Number(req.user.id) && !isActive) {
    throw forbidden('Admins cannot deactivate their own account.');
  }

  const result = await query('UPDATE users SET is_active = :isActive WHERE id = :id', { id, isActive });

  if (result.affectedRows === 0) {
    throw notFound('User was not found.');
  }

  res.json({ id, isActive });
});

