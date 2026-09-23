export default {
  driver: process.env.RABBITMQ_URL ? "rabbitmq" : "memory",
  rabbitmq: { url: process.env.RABBITMQ_URL, prefix: "kinara" },
};
