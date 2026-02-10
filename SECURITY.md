# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in claude-code-hooks, **please do not open a public issue**.

Instead, report it privately:

- **Email:** Open a [GitHub Security Advisory](https://github.com/beefiker/claude-code-hooks/security/advisories/new)
- Or email the maintainer directly (see GitHub profile)

We will acknowledge receipt within **48 hours** and aim to provide a fix or mitigation within **7 days** for critical issues.

## Supported Versions

| Package | Version | Supported |
|---------|---------|-----------|
| claude-sound | 0.2.x | Yes |
| @claude-code-hooks/security | 0.1.x | Yes |
| @claude-code-hooks/secrets | 0.1.x | Yes |
| @claude-code-hooks/core | 0.1.x | Yes |

Only the latest minor version of each package receives security patches.

## Scope

This policy covers:
- All packages in the `packages/` directory
- The monorepo build/publish tooling

Out of scope:
- Third-party dependencies (report upstream)
- User-generated TTS/sound content

## Security Design

These packages run as **Claude Code hooks** — they execute in your local environment. The security and secrets packages specifically exist to *add* safety layers. Their design principles:

- **No network calls** (except TTS generation in claude-sound, which is opt-in)
- **No data exfiltration** — all scanning is local, nothing leaves your machine
- **Minimal dependencies** — smaller attack surface
- **Fail-open by default** — in `warn` mode, hooks never block your workflow

## Disclosure Policy

- We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure).
- Credit will be given to reporters unless they prefer anonymity.

---

# 보안 정책 (한국어)

## 취약점 보고

claude-hooks에서 보안 취약점을 발견하면 **공개 이슈를 열지 마세요**.

대신, 비공개로 보고해 주세요:

- [GitHub 보안 권고](https://github.com/beefiker/claude-code-hooks/security/advisories/new)를 통해 보고
- 또는 메인테이너에게 직접 이메일 (GitHub 프로필 참조)

**48시간** 이내에 수신 확인을 드리고, 심각한 문제의 경우 **7일** 이내에 수정 또는 완화 방안을 제공합니다.

## 지원 버전

각 패키지의 최신 마이너 버전만 보안 패치를 받습니다.

## 범위

이 정책이 적용되는 범위:
- `packages/` 디렉토리의 모든 패키지
- 모노레포 빌드/배포 도구

범위 외:
- 서드파티 의존성 (업스트림에 보고)
- 사용자 생성 TTS/사운드 콘텐츠

## 보안 설계

이 패키지들은 **Claude Code 훅**으로 실행됩니다 — 로컬 환경에서 실행됩니다. security와 secrets 패키지는 안전 계층을 *추가*하기 위해 존재합니다. 설계 원칙:

- **네트워크 호출 없음** (claude-sound의 TTS 생성 제외, 이는 선택적)
- **데이터 유출 없음** — 모든 스캔은 로컬에서 수행, 아무것도 외부로 나가지 않음
- **최소한의 의존성** — 공격 표면 최소화
- **기본 fail-open** — `warn` 모드에서 훅은 워크플로우를 차단하지 않음

## 공개 정책

- [협조적 공개](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure)를 따릅니다.
- 보고자가 익명을 원하지 않는 한 크레딧을 드립니다.
