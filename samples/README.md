# Samples

Each folder is an example service you can copy and adapt.

| Service | Public HTTP | Cluster gRPC | Hooks |
| --- | --- | --- | --- |
| [starter](./starter) | `/health`, `/signup` | — | `user.created` |
| [auth-service](./auth-service) | signup, login, me | `GetUser` | welcome email event |
| [billing-service](./billing-service) | invoices, cache, rate limit | `GetInvoice` | `invoice.paid` |
| [notify-service](./notify-service) | `/health` only | — | email + SMS on domain events |

Point `createApp({ root })` at each `src/` directory. Install the parent package with `npm install` from the sample folder (`file:../..`).
