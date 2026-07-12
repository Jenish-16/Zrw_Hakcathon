import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './lib/env';
import { errorHandler, notFoundHandler } from './middleware/error';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import departmentRoutes from './routes/departments';
import categoryRoutes from './routes/categories';
import assetRoutes from './routes/assets';
import allocationRoutes from './routes/allocations';
import transferRoutes from './routes/transfers';
import bookingRoutes from './routes/bookings';
import maintenanceRoutes from './routes/maintenance';
import auditRoutes from './routes/audits';
import notificationRoutes from './routes/notifications';
import activityRoutes from './routes/activity';
import dashboardRoutes from './routes/dashboard';
import reportRoutes from './routes/reports';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: [env.clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    })
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'assetflow-api' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/assets', assetRoutes);
  app.use('/api/allocations', allocationRoutes);
  app.use('/api/transfers', transferRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/maintenance', maintenanceRoutes);
  app.use('/api/audits', auditRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/reports', reportRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
