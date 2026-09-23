export default {
  driver: process.env.REDIS_URL ? "redis" : "memory",
  redis: { url: process.env.REDIS_URL },
};
