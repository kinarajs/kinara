# CLI

Kinara’s CLI follows Laravel’s `artisan` shape: `kinara <command>`.

```bash
npm install -g @kinarajs/kinara
# or npx kinara …
```

| Command | Laravel cousin | Purpose |
| --- | --- | --- |
| `kinara list` | `artisan list` | Show commands |
| `kinara new <name>` | `laravel new` | Scaffold a service (`create` still works) |
| `kinara serve` | `artisan serve` | Dev server (`dev` still works) |
| `kinara start` | — | `node dist/index.js` |
| `kinara make:module <name>` | `make:controller` | Module + routes + hooks folder |
| `kinara make:hook <module> <id> <event>` | `make:listener` | Hook file |
| `kinara make:middleware <name>` | `make:middleware` | Middleware factory |
| `kinara make:provider <module> <name>` | `make:provider` | Module provider |
| `kinara make:model <name>` | `make:model` | Mongo ORM model |
| `kinara make:rpc <module> <service>` | — | gRPC service |
| `kinara make:seeder <name>` | `make:seeder` | Seeder stub |
| `kinara key:generate` | `key:generate` | `KINARA_KEY` for field encryption |
| `kinara route:list` | `route:list` | Module route files |
| `kinara cache:clear` | `cache:clear` | Cache reminder |

`generate module` / `generate hook` remain as aliases.
