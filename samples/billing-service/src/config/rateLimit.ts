export default {
  enabled: process.env.RATE_LIMIT === "1",
  max: 30,
  windowMs: 60_000,
};
