# Billing service

Invoice CRUD with response envelopes, Redis-ready cache, and an activatable rate limit. Paying an invoice emits `invoice.paid` for notify-service.

```bash
cd samples/billing-service
npm install
npm run dev
```

```bash
curl -s -X POST localhost:3001/invoices -H 'content-type: application/json' -d '{"customerId":"u_1","total":4200}'
curl -s localhost:3001/invoices
curl -s -X POST localhost:3001/invoices/<id>/pay
```
