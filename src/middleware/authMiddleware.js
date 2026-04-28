import { Patient } from '../models/Patient.js';
import { verifyToken } from '../utils/tokenHelper.js';

export const protectPatient = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }
    const decoded = verifyToken(token);
    if (decoded.role !== 'patient') {
      const error = new Error('Patient access required');
      error.statusCode = 403;
      throw error;
    }
    const patient = await Patient.findById(decoded.id);
    if (!patient) {
      const error = new Error('Patient not found');
      error.statusCode = 401;
      throw error;
    }
    req.patient = patient;
    next();
  } catch (err) {
    err.statusCode = err.statusCode || 401;
    next(err);
  }
};
