# Contributing

## Getting Started

```bash
npm install
cp .env.example .env   # set TZ and DATA_DIR
npm run dev            # starts on http://localhost:3000 with auto-reload
```

## Development

- **Tests:** `npm test` — must pass before submitting a PR
- **Type check:** `npm run build` — must compile clean
- **Code style:** TypeScript strict mode; no `any`; no comments explaining what the code does

## Security

This service runs on a local network and communicates with physical hardware. Please follow responsible disclosure for any security issues — open a private [GitHub Security Advisory](https://github.com/x10send/tesla-powerwall-service/security/advisories/new) rather than a public issue.

Never commit credentials, gateway IPs, or `.env` files.

## Pull Requests

- Keep PRs focused — one concern per PR
- Include a clear description of what changed and why
- All tests must pass and TypeScript must compile clean

## License

By contributing you agree that your changes will be licensed under the [MIT License](LICENSE).
