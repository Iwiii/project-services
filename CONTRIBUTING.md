# Contributing

Use Node.js 24 or newer. Install with `npm ci`, then run `npm run check` and `npm test`.

For every behavior change, update both `README.md` and `README.en.md`. Add regression coverage for meaningful lifecycle, isolation, or security behavior. Tests must use temporary registries and isolated PM2 state; never stop the user's global PM2 daemon.

Keep discovered services distinct from managed services. Manual association does not grant process ownership. Do not add direct shell execution to the browser dashboard.

Before opening a pull request, describe the concrete user-facing change and the verification performed. Review the domain vocabulary in `CONTEXT.md` and the MVP scope in `docs/mvp-scope.md`.
