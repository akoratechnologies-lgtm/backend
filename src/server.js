require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5001;

(async () => {
  try {
    await connectDB();

    const server = http.createServer(app);

    // Redis and Socket.IO are optional for the auth flow itself — don't let a
    // missing/unconfigured Redis or socket module block the server from starting.
    try {
      const { connectRedis } = require('./config/redis');
      await connectRedis();
    } catch (err) {
      logger.warn(`Redis not connected (${err.message}) — continuing without it.`);
    }

    try {
      const initSocket = require('./socket/socketHandler');
      initSocket(server);
    } catch (err) {
      logger.warn(`Socket.IO handler not initialized (${err.message}) — continuing without real-time features.`);
    }

    server.listen(PORT, () => {
      logger.info(`AKORA Live backend running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => process.exit(0));
    });
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
})();
