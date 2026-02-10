# Releasing

How we version, tag, and publish packages in the claude-hooks monorepo.

## Versioning

We follow [Semantic Versioning](https://semver.org/) (semver):

- **MAJOR** (`1.0.0` → `2.0.0`): breaking changes
- **MINOR** (`0.1.0` → `0.2.0`): new features, backward-compatible
- **PATCH** (`0.2.0` → `0.2.1`): bug fixes, backward-compatible

While packages are pre-1.0, minor bumps may include breaking changes. After 1.0, we follow strict semver.

## Package Names

| Directory | npm name | Published? |
|-----------|----------|-----------|
| `packages/core` | `@claude-hooks/core` | No (internal) |
| `packages/security` | `@claude-hooks/security` | Yes |
| `packages/secrets` | `@claude-hooks/secrets` | Yes |
| `packages/sound` | `claude-sound` | Yes |

`@claude-hooks/core` is a workspace dependency only — not published to npm.

## Publishing a Package

1. **Bump the version** in the target package's `package.json`:

```bash
cd packages/sound
npm version patch   # or minor / major
```

2. **Commit and tag**:

```bash
git add .
git commit -m "release: claude-sound@0.2.6"
git tag claude-sound@0.2.6
```

3. **Publish** from the package directory:

```bash
cd packages/sound
npm publish --access public
```

For scoped packages:

```bash
cd packages/security
npm publish --access public
```

4. **Push tags**:

```bash
git push && git push --tags
```

## Tag Format

Tags follow the pattern `<package-name>@<version>`:

```
claude-sound@0.2.5
@claude-hooks/security@0.1.0
@claude-hooks/secrets@0.1.0
```

## Pre-publish Checklist

- [ ] `npm install` succeeds from root
- [ ] `npm audit --audit-level=low` passes
- [ ] Package `files` array in `package.json` only includes what's needed
- [ ] `README.md` is up to date in the package directory
- [ ] Version bump is correct (check semver)
- [ ] All changes are committed

## Internal Dependencies

`@claude-hooks/core` is referenced by exact version in consumer packages. When bumping core, also bump the dependency version in `packages/security` and `packages/secrets`.

## Notes

- We do **not** use a publish-all script — each package is published independently.
- The root `package.json` is `private: true` and is never published.
- Prefer `npm version` over hand-editing `package.json` — it handles the git tag too if you pass `--git-tag-version`.

---

# 릴리즈 가이드 (한국어)

claude-hooks 모노레포에서 버전 관리, 태그, 패키지 배포 방법을 설명합니다.

## 버전 관리

[Semantic Versioning](https://semver.org/) (semver)을 따릅니다:

- **MAJOR** (`1.0.0` → `2.0.0`): 호환성을 깨는 변경
- **MINOR** (`0.1.0` → `0.2.0`): 새 기능, 하위 호환
- **PATCH** (`0.2.0` → `0.2.1`): 버그 수정, 하위 호환

1.0 이전 패키지에서는 마이너 범프에 호환성을 깨는 변경이 포함될 수 있습니다. 1.0 이후에는 엄격한 semver를 따릅니다.

## 패키지 배포 방법

1. 대상 패키지의 `package.json`에서 **버전을 올립니다**:

```bash
cd packages/sound
npm version patch   # 또는 minor / major
```

2. **커밋하고 태그합니다**:

```bash
git add .
git commit -m "release: claude-sound@0.2.6"
git tag claude-sound@0.2.6
```

3. 패키지 디렉토리에서 **배포합니다**:

```bash
cd packages/sound
npm publish --access public
```

스코프 패키지의 경우:

```bash
cd packages/security
npm publish --access public
```

4. **태그를 푸시합니다**:

```bash
git push && git push --tags
```

## 태그 형식

태그는 `<패키지이름>@<버전>` 형식을 따릅니다:

```
claude-sound@0.2.5
@claude-hooks/security@0.1.0
@claude-hooks/secrets@0.1.0
```

## 배포 전 체크리스트

- [ ] 루트에서 `npm install` 성공
- [ ] `npm audit --audit-level=low` 통과
- [ ] `package.json`의 `files` 배열에 필요한 것만 포함
- [ ] 패키지 디렉토리의 `README.md`가 최신 상태
- [ ] 버전 범프가 올바른지 확인 (semver)
- [ ] 모든 변경 사항이 커밋됨

## 내부 의존성

`@claude-hooks/core`는 소비자 패키지에서 정확한 버전으로 참조됩니다. core를 범프할 때 `packages/security`와 `packages/secrets`의 의존성 버전도 함께 올려야 합니다.

## 참고

- "모두 배포" 스크립트를 사용하지 않습니다 — 각 패키지를 독립적으로 배포합니다.
- 루트 `package.json`은 `private: true`이며 절대 배포되지 않습니다.
- `package.json`을 직접 편집하는 것보다 `npm version`을 선호합니다 — `--git-tag-version`을 전달하면 git 태그도 처리합니다.
