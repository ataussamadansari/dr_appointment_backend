import { Admin } from '../models/Admin.js';
import { verifyToken } from '../utils/tokenHelper.js';

export const protectAdmin = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }
    const decoded = verifyToken(token);
    if (decoded.role !== 'admin') {
      const error = new Error('Admin access required');
      error.statusCode = 403;
      throw error;
    }
    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      const error = new Error('Admin not found');
      error.statusCode = 401;
      throw error;
    }
    req.admin = admin;
    next();
  } catch (err) {
    err.statusCode = err.statusCode || 401;
    next(err);
  }
};
