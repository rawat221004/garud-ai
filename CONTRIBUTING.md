# Contributing to GARUD AI

Fork the repository and create a branch for a focused change. Follow the [README](README.md) to run both services locally. Describe the change and how you verified it in your pull request.

- Run Python tests from `backend/` with `python -m pytest`.
- Run `npm ci` and `npm run build` from `frontend/`.
- Use fictional reports and a separate local SQLite database for workflow checks. Never attach real incident reports, provider credentials, or database files.
- Preserve source attribution, freshness labels and the distinction between observed events, forecasts, and simulations. Add regression tests when changing risk boundaries, persistence, or incident transitions.
- For changes to external data collection, document the provider, endpoint, usage terms, and how the app handles unavailable data.

For a security issue, follow [SECURITY.md](SECURITY.md). Contributions to the project are made under its [MIT License](LICENSE).
