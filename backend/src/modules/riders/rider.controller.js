import { query, transaction } from '../../config/db.js';
import { ROLES } from '../../constants/roles.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { badRequest, forbidden, notFound } from '../../utils/http-error.js';

function mapRider(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    vehicleType: row.vehicle_type,
    plateNumber: row.plate_number,
    isAvailable: Boolean(row.is_available),
    currentStatus: row.current_status,
    createdAt: row.created_at
  };
}

export const listRiders = asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT rp.*, u.name, u.email, u.phone
     FROM rider_profiles rp
     JOIN users u ON u.id = rp.user_id
     ORDER BY u.name ASC`
  );

  res.json({ riders: rows.map(mapRider) });
});

export const createRiderProfile = asyncHandler(async (req, res) => {
  const { userId, vehicleType, plateNumber = null } = req.validated.body;
  const users = await query('SELECT id, role FROM users WHERE id = :userId LIMIT 1', { userId });
  const user = users[0];

  if (!user) {
    throw badRequest('User account does not exist.');
  }

  const existingProfile = await query('SELECT id FROM rider_profiles WHERE user_id = :userId LIMIT 1', { userId });

  if (existingProfile[0]) {
    throw badRequest('User already has a rider profile.');
  }

  const riderId = await transaction(async (connection) => {
    await connection.execute('UPDATE users SET role = :role WHERE id = :userId', {
      role: ROLES.RIDER,
      userId
    });

    const [result] = await connection.execute(
      `INSERT INTO rider_profiles (user_id, vehicle_type, plate_number)
       VALUES (:userId, :vehicleType, :plateNumber)`,
      { userId, vehicleType, plateNumber }
    );

    return result.insertId;
  });

  const rows = await query(
    `SELECT rp.*, u.name, u.email, u.phone
     FROM rider_profiles rp
     JOIN users u ON u.id = rp.user_id
     WHERE rp.id = :riderId
     LIMIT 1`,
    { riderId }
  );

  res.status(201).json({ rider: mapRider(rows[0]) });
});

export const getMyRiderProfile = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.RIDER) {
    throw forbidden('Only rider accounts have rider profiles.');
  }

  const rows = await query(
    `SELECT rp.*, u.name, u.email, u.phone
     FROM rider_profiles rp
     JOIN users u ON u.id = rp.user_id
     WHERE rp.user_id = :userId
     LIMIT 1`,
    { userId: req.user.id }
  );

  if (!rows[0]) {
    throw notFound('Rider profile was not found.');
  }

  res.json({ rider: mapRider(rows[0]) });
});

export const updateMyRiderStatus = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.RIDER) {
    throw forbidden('Only riders can update rider status.');
  }

  const { currentStatus } = req.validated.body;
  const result = await query(
    `UPDATE rider_profiles
     SET current_status = :currentStatus, is_available = :isAvailable
     WHERE user_id = :userId`,
    {
      currentStatus,
      isAvailable: currentStatus === 'available',
      userId: req.user.id
    }
  );

  if (result.affectedRows === 0) {
    throw notFound('Rider profile was not found.');
  }

  res.json({ currentStatus, isAvailable: currentStatus === 'available' });
});
