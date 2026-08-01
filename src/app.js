const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const reportRoutes = require('./routes/reportRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const giftRoutes = require('./routes/giftRoutes');
// Keep your existing wallet/match routes mounted exactly as before:
const walletRoutes = require('./routes/walletRoutes');
const matchRoutes = require('./routes/matchRoutes');
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url);
  next();
});
app.use(helmet());
app.use(cors({
  // Comma-separated list in .env, e.g. "http://localhost:3000,http://localhost:8081"
  // Falls back to "*" only if CLIENT_ORIGIN isn't set (fine for local dev, NOT for production).
  origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : '*',
  credentials: true,
  
}));
app.use(hpp());
// Raised from 10kb: profile photos are uploaded as base64 JSON, which is
// ~33% larger than the raw file; 8mb comfortably covers a typical photo.
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));
// app.use(mongoSanitize());
// app.use(xss());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Serves uploaded profile photos (see userController.uploadPhoto) at
// http://<host>/uploads/<userId>/<filename>
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/', (req, res) => {
  res.json({ success: true, message: 'AKORA Live Backend Running' });
});
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/gifts', giftRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/match', matchRoutes);
app.use("/api/notifications", notificationRoutes);
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

module.exports = app;