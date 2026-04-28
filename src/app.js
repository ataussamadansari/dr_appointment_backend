import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { agoraRoutes } from './routes/agoraRoutes.js';
import { appointmentRoutes } from './routes/appointmentRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { patientRoutes } from './routes/patientRoutes.js';
import { paymentRoutes } from './routes/paymentRoutes.js';
import { prescriptionRoutes } from './routes/prescriptionRoutes.js';
import { whatsappRoutes } from './routes/whatsappRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use('/files', express.static(path.resolve(__dirname, '../storage')));

app.get('/health', (req, res) => res.json({ success: true, message: 'OK' }));
app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/agora', agoraRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/whatsapp', whatsappRoutes);

app.use(notFound);
app.use(errorHandler);
