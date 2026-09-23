# Notify service

No public write API. It listens for `notify.email.requested`, `user.created`, and `invoice.paid`, then sends email/SMS behind an OpenTelemetry span. Point `log.s3` at a bucket in production.

```bash
cd samples/notify-service
npm install
RABBITMQ_URL=amqp://127.0.0.1 npm run dev
```

Hooks stay cheap: they log and record a span. Swap the body of `sendEmail` / `sendSms` for your provider.
