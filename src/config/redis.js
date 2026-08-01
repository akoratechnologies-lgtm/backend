const { createClient } = require('redis');
const logger = require('../utils/logger');

const redisClient = createClient({ url: process.env.REDIS_URL });

redisClient.on('error', (err) => logger.error('Redis error', err));

async function connectRedis() {
  await redisClient.connect();
  logger.info('Redis connected');
}

module.exports = { redisClient, connectRedis };
