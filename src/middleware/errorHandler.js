import { sendError } from '../utils/response.js';

export const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  // MongoDB duplicate key error (E11000) — token already taken by another user
  if (err.code === 11000 || err.name === 'MongoServerError' && err.code === 11000) {
    return sendError(res, 'This token was just booked by someone else. Please try again — a new token will be assigned.', 409);
  }
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;
  if (process.env.NODE_ENV !== 'test') {
    console.error(err);
  }
  sendError(res, message, statusCode, err.errors || null);
};
