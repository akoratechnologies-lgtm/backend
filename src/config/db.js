const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGO_URI, {
    autoIndex: process.env.NODE_ENV !== 'production',
  });
  logger.info('MongoDB connected');
}

module.exports = connectDB;
