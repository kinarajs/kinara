# Auth service

Signup, login, and `GET /me` with role permissions. Other services call `GetUser` over gRPC instead of reaching Mongo themselves.

```bash
cd samples/auth-service
npm install
npm run dev
```

Try:

```bash
curl -s localhost:3000/health
curl -s -X POST localhost:3000/signup -H 'content-type: application/json' -d '{"email":"ada@yalu.dev","password":"secret12"}'
curl -s -X POST localhost:3000/login -H 'content-type: application/json' -d '{"email":"ada@yalu.dev","password":"secret12"}'
curl -s localhost:3000/me -H "authorization: Bearer <token>"
```
