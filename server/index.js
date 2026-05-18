// /server/index.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './src/config/env.js';
import { testConnection, closePool } from './src/config/db.js';
import { apiLimiter } from './src/middleware/rateLimiter.js';

// Import routes
import authRoutes from './src/routes/auth.js';
import userRoutes from './src/routes/users.js';
import groupRoutes from './src/routes/groups.js';
import expenseRoutes from './src/routes/expenses.js';
import settlementRoutes from './src/routes/settlements.js';
import dashboardRoutes from './src/routes/dashboard.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: env.clientUrl,
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting for API routes
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/groups', expenseRoutes);
app.use('/api/groups', settlementRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: env.nodeEnv === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    app.listen(env.port, () => {
      console.log(`✓ Server running on port ${env.port}`);
      console.log(`✓ Environment: ${env.nodeEnv}`);
      console.log(`✓ Client URL: ${env.clientUrl}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await closePool();
  process.exit(0);
});

startServer();
