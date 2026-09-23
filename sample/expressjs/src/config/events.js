export default {
  driver: process.env.EVENT_DRIVER ?? "memory",
  rabbitmq: {
    url: process.env.RABBITMQ_URL,
    prefix: "kinara",
  },
};
