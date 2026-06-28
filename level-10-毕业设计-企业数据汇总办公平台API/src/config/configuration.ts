export default () => ({
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  jwt: {
    secret: process.env.JWT_SECRET || "fallback-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  database: { url: process.env.DATABASE_URL },
  redis: { url: process.env.REDIS_URL },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || "60000", 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || "20", 10),
  },
});
