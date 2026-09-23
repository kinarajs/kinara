# WebSockets

```bash
npm install ws
```

```ts
// src/config/app.ts
export default { websocket: true };
```

```ts
app.ws.onConnection((client) => {
  client.join("ops");
  client.send("hello", { id: client.id });
});

app.ws.to("ops").emit("deployed", { version: "1.2.3" });
app.ws.broadcast("ping");
```

Messages are `{ event, payload, meta: { requestId } }`. Emits are traced (`ws.emit`). Attach happens in `app.listen()` when `app.websocket` is true.
