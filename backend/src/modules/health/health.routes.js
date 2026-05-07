import { Router } from 'express';
import { pool } from '../../config/db.js';
import { getRedis } from '../../config/redis.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const healthRoutes = Router();

healthRoutes.get(
  '/',
  asyncHandler(async (_req, res) => {
    await pool.query('SELECT 1');
    await getRedis().ping();

    res.json({
      status: 'ok',
      database: 'ok',
      redis: 'ok',
      timestamp: new Date().toISOString()
    });
  })
);
