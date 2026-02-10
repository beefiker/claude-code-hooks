# @claude-code-hooks/sound

## English (main)

Scoped edition of **claude-sound**.

Cross-platform CLI (macOS, Windows, Linux) that configures **Claude Code Hooks** to play **bundled sounds**.

- Setup UI: `npx @claude-code-hooks/sound@latest`
- Hook runner: `npx --yes @claude-code-hooks/sound@latest play --event <Event> --sound <SoundId> --managed-by @claude-code-hooks/sound`

> Note: the legacy unscoped package `claude-sound` still exists for backwards compatibility.

## 한국어 (sub)

**claude-sound**의 스코프 버전입니다.

Claude Code Hooks를 설정해서 이벤트 발생 시 번들 사운드를 재생하는 크로스플랫폼 CLI(macOS/Windows/Linux)입니다.

- 실행(설정 UI): `npx @claude-code-hooks/sound@latest`
- 훅 실행기: `npx --yes @claude-code-hooks/sound@latest play --event <Event> --sound <SoundId> --managed-by @claude-code-hooks/sound`

> 참고: 기존 사용자 호환을 위해 unscoped 패키지 `claude-sound`도 계속 유지됩니다.

## Install / run

```bash
npx @claude-code-hooks/sound@latest
```

You’ll be prompted to choose where to write settings:

- Project (shared): `.claude/settings.json`
- Project (local): `.claude/settings.local.json`
- Global: `~/.claude/settings.json`

## What gets written

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "npx --yes @claude-code-hooks/sound@latest play --event SessionStart --sound ring1 --managed-by @claude-code-hooks/sound",
            "async": true,
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

This package only manages hook handlers whose command contains:

```
--managed-by @claude-code-hooks/sound
```
