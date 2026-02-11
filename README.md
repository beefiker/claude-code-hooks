# claude-code-hooks

A monorepo for Claude Code hook tooling: small, composable packages that make Claude Code feel **safe** and **comfy**.

Right now this repo contains:

- `packages/cli` → **@claude-code-hooks/cli**: umbrella wizard to setup/uninstall hook packages.
- `packages/sound` → **@claude-code-hooks/sound**: configure Claude Code hooks to play notification sounds.
- `packages/notification` → **@claude-code-hooks/notification**: show OS notifications on Claude Code hook events.
- `packages/security` → **@claude-code-hooks/security**: warn/block risky commands and tool invocations.
- `packages/secrets` → **@claude-code-hooks/secrets**: warn/block secret-like tokens (keys, private keys) in tool inputs.

## Install / run (wizard)

From anywhere:

```bash
npx @claude-code-hooks/cli@latest
```

![CLI install and usage demo](images/claude-code-hooks-cli.gif)

## Install / run (sound)

From anywhere:

```bash
npx @claude-code-hooks/sound@latest
```

## Install / run (notification)

From anywhere:

```bash
npx @claude-code-hooks/notification@latest
```

From this repo (workspace dev):

```bash
cd claude-code-hooks
npm install

# run the interactive setup UI
node packages/sound/src/cli.js
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
In practice: we keep the CLI commands stable (bins like `claude-security`, `claude-secrets`, `claude-sound`) and provide a single umbrella wizard (`npx @claude-code-hooks/cli@latest`).
