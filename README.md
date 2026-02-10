# claude-hooks

A monorepo for Claude Code hook tooling: small, composable packages that make Claude Code feel **safe** and **comfy**.

Right now this repo contains:

- `packages/sound` → **claude-sound**: configure Claude Code hooks to play notification sounds.
- `packages/security` → **@claude-hooks/security**: warn/block risky commands and tool invocations.
- `packages/secrets` → **@claude-hooks/secrets**: warn/block secret-like tokens (keys, private keys) in tool inputs.

## Install / run (sound)

From anywhere:

```bash
npx claude-sound@latest
```

From this repo (workspace dev):

```bash
cd claude-hooks
npm install

# run the interactive setup UI
npm -w claude-sound start --if-present || node packages/sound/src/cli.js
```

## Workspace structure

- `packages/*` — independently publishable packages

## Docs

- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Releasing](RELEASING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

> 한국어 안내는 각 문서 하단에 포함되어 있습니다. (Korean translations are included at the bottom of each document.)

## License

[MIT](LICENSE)

## Publishing philosophy

Even though we’re using a monorepo layout, we keep **backwards compatibility** for users as a hard rule.
For example, the sound package remains published as `claude-sound` so existing hook commands like `npx claude-sound@latest ...` keep working.
