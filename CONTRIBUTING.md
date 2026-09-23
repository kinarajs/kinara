# Contributing

1. `npm install`
2. `npm test`
3. `npm run typecheck`

Add a test next to the feature you change. Keep the public API small. Hooks live in `modules/<name>/hooks/`.

Releases: bump `package.json` version, tag `vX.Y.Z`, and publish a GitHub release. The API is unstable until 1.0.0.
