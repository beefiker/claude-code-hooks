# Contributing to claude-code-hooks

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Getting Started

1. **Fork & clone** the repo:

```bash
git clone https://github.com/<your-fork>/claude-code-hooks.git
cd claude-code-hooks
npm install
```

2. The repo is an **npm workspaces** monorepo. Packages live under `packages/`.

3. Use Node.js **18+**.

## Development Workflow

```bash
# Install all workspace dependencies
npm install

# Run a command in a specific package
npm -w claude-sound <command>
npm -w @claude-code-hooks/security <command>
npm -w @claude-code-hooks/secrets <command>

# Run tests across all packages
npm test

# Run linting across all packages
npm run lint
```

## Making Changes

1. Create a **feature branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Keep commits **small and focused**. One logical change per commit.
3. Follow existing code style — the codebase is plain JS (ES modules), no transpiler needed.
4. Test your changes locally before pushing.

## Pull Requests

- Open a PR against `main`.
- Describe **what** changed and **why**.
- Link related issues if applicable.
- Keep PRs small. Prefer multiple small PRs over one massive one.

## Reporting Bugs

Open a [GitHub issue](https://github.com/beefiker/claude-code-hooks/issues) with:
- Steps to reproduce
- Expected vs actual behavior
- OS + Node.js version

## Code of Conduct

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

# 기여 가이드 (한국어)

claude-hooks에 기여해 주셔서 감사합니다! 아래는 시작하는 데 필요한 모든 내용입니다.

## 시작하기

1. 저장소를 **포크 & 클론**합니다:

```bash
git clone https://github.com/<your-fork>/claude-code-hooks.git
cd claude-code-hooks
npm install
```

2. 이 저장소는 **npm workspaces** 모노레포입니다. 패키지는 `packages/` 아래에 있습니다.

3. Node.js **18 이상**을 사용하세요.

## 개발 워크플로우

```bash
# 전체 워크스페이스 의존성 설치
npm install

# 특정 패키지에서 명령 실행
npm -w claude-sound <command>
npm -w @claude-code-hooks/security <command>
npm -w @claude-code-hooks/secrets <command>

# 전체 패키지 테스트
npm test
```

## 변경 사항 작성

1. `main`에서 **기능 브랜치**를 생성합니다.
2. 커밋은 **작고 집중적**으로 유지합니다. 하나의 논리적 변경에 하나의 커밋.
3. 기존 코드 스타일을 따릅니다 — 코드베이스는 순수 JS (ES 모듈)이며 트랜스파일러가 필요 없습니다.
4. 푸시하기 전에 로컬에서 변경 사항을 테스트합니다.

## 풀 리퀘스트

- `main` 브랜치에 대해 PR을 엽니다.
- **무엇**이 변경되었고 **왜** 변경했는지 설명합니다.
- 관련 이슈가 있으면 링크합니다.
- PR은 작게 유지합니다. 하나의 거대한 PR보다 여러 개의 작은 PR을 선호합니다.

## 버그 보고

[GitHub 이슈](https://github.com/beefiker/claude-code-hooks/issues)를 열고 다음을 포함하세요:
- 재현 단계
- 예상 동작 vs 실제 동작
- OS + Node.js 버전

## 행동 강령

[행동 강령](CODE_OF_CONDUCT.md)을 따라주세요.

## 라이선스

기여함으로써, 귀하의 기여가 [MIT 라이선스](LICENSE) 하에 라이선스됨에 동의합니다.
