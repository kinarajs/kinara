export default process.env.LOG_BUCKET
  ? { s3: { bucket: process.env.LOG_BUCKET, prefix: "notify", region: process.env.AWS_REGION } }
  : {};
