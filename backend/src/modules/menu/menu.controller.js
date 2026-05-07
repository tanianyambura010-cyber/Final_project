import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { badRequest, notFound } from '../../utils/http-error.js';

function mapMenuItem(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    price: row.price,
    imageUrl: row.image_url,
    isAvailable: Boolean(row.is_available),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const listMenuItems = asyncHandler(async (req, res) => {
  const { category, available, search } = req.validated.query;
  const filters = [];
  const params = {};

  if (category) {
    filters.push('category = :category');
    params.category = category;
  }

  if (available) {
    filters.push('is_available = :available');
    params.available = available === 'true';
  }

  if (search) {
    filters.push('(name LIKE :search OR description LIKE :search)');
    params.search = `%${search}%`;
  }

  const rows = await query(
    `SELECT *
     FROM menu_items
     ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
     ORDER BY category ASC, name ASC`,
    params
  );

  res.json({ items: rows.map(mapMenuItem) });
});

export const getMenuItem = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM menu_items WHERE id = :id LIMIT 1', req.validated.params);
  const item = rows[0];

  if (!item) {
    throw notFound('Menu item was not found.');
  }

  res.json({ item: mapMenuItem(item) });
});

export const createMenuItem = asyncHandler(async (req, res) => {
  const { name, description = null, category, price, imageUrl = null, isAvailable = true } = req.validated.body;
  const result = await query(
    `INSERT INTO menu_items (name, description, category, price, image_url, is_available)
     VALUES (:name, :description, :category, :price, :imageUrl, :isAvailable)`,
    { name, description, category, price, imageUrl, isAvailable }
  );
  const rows = await query('SELECT * FROM menu_items WHERE id = :id LIMIT 1', { id: result.insertId });

  res.status(201).json({ item: mapMenuItem(rows[0]) });
});

export const updateMenuItem = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const body = req.validated.body;
  const fields = [];
  const params = { id };

  const fieldMap = {
    name: 'name',
    description: 'description',
    category: 'category',
    price: 'price',
    imageUrl: 'image_url',
    isAvailable: 'is_available'
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      fields.push(`${column} = :${key}`);
      params[key] = body[key];
    }
  }

  if (fields.length === 0) {
    throw badRequest('No menu item fields were provided for update.');
  }

  await query(`UPDATE menu_items SET ${fields.join(', ')} WHERE id = :id`, params);
  const rows = await query('SELECT * FROM menu_items WHERE id = :id LIMIT 1', { id });

  if (!rows[0]) {
    throw notFound('Menu item was not found.');
  }

  res.json({ item: mapMenuItem(rows[0]) });
});

export const updateAvailability = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { isAvailable } = req.validated.body;
  const result = await query(
    'UPDATE menu_items SET is_available = :isAvailable WHERE id = :id',
    { id, isAvailable }
  );

  if (result.affectedRows === 0) {
    throw notFound('Menu item was not found.');
  }

  res.json({ id, isAvailable });
});

