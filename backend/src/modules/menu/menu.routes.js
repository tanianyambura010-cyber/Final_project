import { Router } from 'express';
import { mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import multer from 'multer';
import { STAFF_ROLES } from '../../constants/roles.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createMenuItem,
  getMenuItem,
  listMenuItems,
  updateAvailability,
  updateMenuItem,
  uploadMenuImage
} from './menu.controller.js';
import {
  createMenuItemSchema,
  listMenuSchema,
  menuIdSchema,
  updateAvailabilitySchema,
  updateMenuItemSchema
} from './menu.validation.js';

export const menuRoutes = Router();
const menuUploadDirectory = fileURLToPath(new URL('../../../uploads/menu/', import.meta.url));

mkdirSync(menuUploadDirectory, { recursive: true });

const menuImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, menuUploadDirectory);
    },
    filename: (_req, file, callback) => {
      const extension = extname(file.originalname).toLowerCase() || '.jpg';
      const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
      callback(null, safeName);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('Only image files can be uploaded.'));
      return;
    }

    callback(null, true);
  }
});

menuRoutes.get('/', validate(listMenuSchema), listMenuItems);
menuRoutes.post(
  '/images',
  requireAuth,
  requireRole(...STAFF_ROLES),
  menuImageUpload.single('image'),
  uploadMenuImage
);
menuRoutes.get('/:id', validate(menuIdSchema), getMenuItem);
menuRoutes.post('/', requireAuth, requireRole(...STAFF_ROLES), validate(createMenuItemSchema), createMenuItem);
menuRoutes.patch('/:id', requireAuth, requireRole(...STAFF_ROLES), validate(updateMenuItemSchema), updateMenuItem);
menuRoutes.patch(
  '/:id/availability',
  requireAuth,
  requireRole(...STAFF_ROLES),
  validate(updateAvailabilitySchema),
  updateAvailability
);

