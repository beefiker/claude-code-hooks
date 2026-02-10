/**
 * Centralized i18n for claude-code-hooks. All user-facing strings live here.
 * Use t(key, locale) where locale is 'en' (default) or 'ko'.
 * Sound file names (IDs) are never translated.
 */

/** @type {Record<string, Record<string, string>>} */
const STRINGS = {
  en: {
    // Common
    cancelled: 'Cancelled',
    bye: 'Bye',
    noChangesWritten: 'No changes written',
    done: 'Done',
    error: 'Error',
    back: 'Back',
    apply: 'Apply',
    exit: 'Exit',
    remove: 'Remove',
    recommended: '(recommended)',
    disabled: 'disabled',

    // CLI umbrella
    cliUsage: `claude-code-hooks

Usage:
  npx @claude-code-hooks/cli@latest [options]

Options:
  -h, --help    Show help
  --ko          Use Korean UI (same as --lang ko)
  --lang <code> Set language (en, ko). Default: en

Notes:
  - This wizard can update your Claude Code settings (global) or generate project-only config + snippet.`,
    cliStep1Action: 'Action',
    cliStep2Target: 'Target',
    cliStep3Packages: 'Packages',
    cliStep4Configure: 'Configure',
    cliStep5Review: 'Review',
    cliActionSetup: 'Setup / enable packages',
    cliActionUninstall: 'Uninstall / remove managed hooks',
    cliActionExit: 'Exit',
    cliTargetGlobal: 'Global (default): ~/.claude/settings.json',
    cliTargetProjectOnly: 'Project-only: write {config} + print snippet',
    cliTargetBack: 'Back',
    cliPkgSecurity: '@claude-code-hooks/security',
    cliPkgSecurityHint: 'Warn/block risky commands',
    cliPkgSecrets: '@claude-code-hooks/secrets',
    cliPkgSecretsHint: 'Detect secret-like tokens',
    cliPkgSound: '@claude-code-hooks/sound',
    cliPkgSoundHint: 'Play sounds on events',
    cliPkgNotification: '@claude-code-hooks/notification',
    cliPkgNotificationHint: 'OS notifications on events',
    cliContinue: 'Continue to configure selected packages?',
    cliSnippetPrompt: 'Write snippet file to {path}?',
    cliWroteSnippet: 'Wrote snippet',
    cliPasteSnippet: 'Paste into ~/.claude/settings.json',
    cliReviewAction: 'Action',
    cliReviewTarget: 'Target',
    cliReviewGlobal: 'global settings',
    cliReviewProjectOnly: 'project-only',
    cliReviewPackages: 'Packages',
    cliReviewFiles: 'Files',
    cliApply: 'Apply?',
    cliWritingProject: 'Writing project config...',
    cliProjectConfigWritten: 'Project config written',
    cliApplyingGlobal: 'Applying changes to global settings...',
    cliSaved: 'Saved',
    cliConfigureSummary: 'Configure',
    cliRemoveManagedHooks: 'remove managed hooks',
    cliEventCount: 'event(s)',
    cliCouldNotRead: 'Could not read/parse JSON at {path}',

    // Security
    securityFoundConfig: 'Found existing claude-code-hooks.config.json — using it to pre-fill defaults.',
    securityHowBehave: 'How should it behave when it detects a risk?',
    securityWarn: 'Warn only',
    securityBlock: 'Block on PreToolUse only (exit 2)',
    securityWhichEvents: 'Which events should be guarded?',
    securityBeforeTool: 'Before a tool runs',
    securityToolPermission: 'Tool asks for permission',

    // Security runner
    securitySuppressedAllow: 'Risks suppressed by allow pattern in claude-code-hooks.config.json',
    securitySuppressedIgnore: 'Risks suppressed by ignore pattern in claude-code-hooks.config.json',
    securityNoRisks: 'No obvious risks detected by heuristics.',
    securityDetectedRisks: 'Detected {n} potential risk(s):',
    securityNoteHeuristic: 'Note: This is heuristic-only. It may miss risks or flag false positives. Configure warn vs block in setup.',
    securityBlocked: 'Blocked by claude-security (mode=block).',

    // Security risk ids (title, detail)
    'security.risk.rm-rf.title': 'Destructive delete (rm -rf)',
    'security.risk.rm-rf.detail': 'Command contains rm -rf / rm -fr.',
    'security.risk.pipe-to-shell.title': 'Piping network to shell',
    'security.risk.pipe-to-shell.detail': 'Detected curl|bash or wget|sh pattern.',
    'security.risk.chmod-777.title': 'Over-permissive chmod 777',
    'security.risk.chmod-777.detail': 'Detected chmod 777.',
    'security.risk.ssh-write.title': 'Potential SSH config/key write',
    'security.risk.ssh-write.detail': 'Command references ~/.ssh and key/config files.',
    'security.risk.git-push-main.title': 'Git push to main/master',
    'security.risk.git-push-main.detail': 'Detected git push to main/master.',
    'security.risk.chown-root.title': 'chown involving root',
    'security.risk.chown-root.detail': 'Detected chown targeting root.',
    'security.risk.sudo.title': 'Uses sudo',
    'security.risk.sudo.detail': 'Command contains sudo.',

    // Secrets
    secretsFoundConfig: 'Found existing claude-code-hooks.config.json — using it to pre-fill defaults.',
    secretsHowBehave: 'How should it behave when it detects a secret-like token?',
    secretsWarn: 'Warn only',
    secretsBlock: 'Block on HIGH only (private key material)',
    secretsWhichEvents: 'Which events should be scanned?',
    secretsScanGitCommit: 'Scan staged files for secrets on git commit?',

    // Secrets runner
    secretsSuppressedAllow: 'Findings suppressed by allow pattern in claude-code-hooks.config.json',
    secretsSuppressedIgnore: 'Findings suppressed by ignore pattern in claude-code-hooks.config.json',
    secretsNoFindings: 'No obvious secrets detected by heuristics.',
    secretsDetected: 'Detected {n} potential secret(s):',
    secretsTip: 'Tip: Move secrets to env vars / secret manager; never paste private keys or long-lived tokens into tool inputs.',
    secretsBlocked: 'Blocked by claude-secrets (HIGH confidence secret).',

    // Secrets finding ids
    'secrets.finding.private-key.title': 'Private key material',
    'secrets.finding.private-key.detail': 'Detected a private key header (BEGIN ... PRIVATE KEY).',
    'secrets.finding.openai.title': 'OpenAI API key-like token',
    'secrets.finding.openai.detail': 'Detected token matching sk-... pattern.',
    'secrets.finding.github.title': 'GitHub token-like secret',
    'secrets.finding.github.detail': 'Detected GitHub token pattern (ghp_ / github_pat_).',
    'secrets.finding.aws-akid.title': 'AWS Access Key ID-like token',
    'secrets.finding.aws-akid.detail': 'Detected AWS access key id pattern (AKIA...).',
    'secrets.finding.slack.title': 'Slack token-like secret',
    'secrets.finding.slack.detail': 'Detected Slack token pattern (xox*).',

    // Sound
    soundPickEvents: 'Pick events and choose a sound for each. (You can keep this minimal.)',
    soundLegendStandalone: 'Hint shows meaning; "inherited" means already set in ~/.claude/settings.json',
    soundLegendUmbrella: 'Hint shows meaning (and inherited)',
    soundWhichEvents: 'Which events should play sounds?',
    soundCategoryFor: 'Category for',
    soundFor: 'Sound for',
    soundCommon: 'Common',
    soundGame: 'Game',
    soundRing: 'Ring',
    soundCustom: 'Custom',
    soundInherited: 'inherited',
    soundWhereWrite: 'Where do you want to write Claude Code hook settings?',
    soundScopeProject: 'Project (shared): .claude/settings.json',
    soundScopeProjectLocal: 'Project (local): .claude/settings.local.json (gitignored)',
    soundScopeGlobal: 'Global: ~/.claude/settings.json',
    soundInfoInherited: 'Events marked "(from global)" or "(from project)" use parent settings. Configure here to override.',
    soundApply: 'Apply (write settings)',
    soundRemoveAll: 'Remove all claude-sound hooks',
    soundExitNoChanges: 'Exit (no changes)',
    soundGrayInherited: '· Gray = inherited',
    soundCleared: 'All claude-sound mappings cleared (not written yet). Choose Apply to save.',
    soundWriting: 'Writing settings...',
    soundSavedHooks: 'Saved hooks to',
    soundEventChange: 'Change sound',
    soundEventEnable: 'Enable & choose sound',
    soundEventDisable: 'Disable (remove mapping)',
    soundPickCategory: 'Pick a category for',
    soundPathToFile: 'Path to MP3 or WAV file',
    soundPathPlaceholder: './my-sound.mp3 or /path/to/sound.wav',
    soundPathEmpty: 'Path cannot be empty',
    soundImporting: 'Importing...',
    soundImported: 'Imported and selected',
    soundFailed: 'Failed',
    soundLanguage: 'Language for speech',
    soundLangEn: 'English (default)',
    soundLangKo: 'Korean (한국어)',
    soundEnterText: 'Enter text to speak',
    soundTextPlaceholder: 'Claude is ready!',
    soundTextPlaceholderKo: '클로드가 준비됐어요!',
    soundTextEmpty: 'Text cannot be empty',
    soundTextTooLong: 'Keep it under 200 characters',
    soundGenerating: 'Generating speech...',
    soundCreated: 'Created and selected',
    soundPickSound: 'Pick a sound for',
    soundEscBack: '(ESC to back)',
    soundPreviewKeys: '(↑/↓ preview)',
    soundMissingSound: 'Missing --sound <id>',
    soundPlayFailed: "Failed to play sound '{id}': {err}",
    soundImportMissing: 'Missing path. Usage: claude-sound import <path-to-mp3-or-wav>',
    soundImportFailed: 'Import failed: {err}',

    // Sound event descriptions
    'sound.ev.SessionStart': 'New session begins',
    'sound.ev.UserPromptSubmit': 'User sends a prompt',
    'sound.ev.PreToolUse': 'Before a tool runs',
    'sound.ev.PermissionRequest': 'Tool asks for permission',
    'sound.ev.PostToolUse': 'After a tool completes',
    'sound.ev.PostToolUseFailure': 'Tool execution failed',
    'sound.ev.Notification': 'Claude sends a notification',
    'sound.ev.SubagentStart': 'Sub-agent spawned',
    'sound.ev.SubagentStop': 'Sub-agent finished',
    'sound.ev.Stop': 'Claude stops responding',
    'sound.ev.TeammateIdle': 'Teammate becomes idle',
    'sound.ev.TaskCompleted': 'Task finished',
    'sound.ev.PreCompact': 'Before context compaction',
    'sound.ev.SessionEnd': 'Session ends',

    // Notification
    notificationPickEvents: 'Pick events to trigger OS notifications. (Keep it minimal.)',
    notificationHeadless: 'Notification will no-op in remote/headless environments; it falls back to stdout.',
    notificationWhichEvents: 'Which events should show OS notifications?',
    'notification.ev.SessionStart': 'Session begins or resumes',
    'notification.ev.UserPromptSubmit': 'You submit a prompt',
    'notification.ev.PreToolUse': 'Before a tool runs',
    'notification.ev.PermissionRequest': 'Permission dialog appears',
    'notification.ev.PostToolUse': 'Tool call succeeds',
    'notification.ev.PostToolUseFailure': 'Tool call fails',
    'notification.ev.Notification': 'Claude Code sends a notification',
    'notification.ev.SubagentStart': 'Sub-agent spawned',
    'notification.ev.SubagentStop': 'Sub-agent finishes',
    'notification.ev.Stop': 'Claude finishes responding',
    'notification.ev.TeammateIdle': 'Teammate about to go idle',
    'notification.ev.TaskCompleted': 'Task marked completed',
    'notification.ev.PreCompact': 'Before context compaction',
    'notification.ev.SessionEnd': 'Session terminates',

    // Setup (standalone security/secrets)
    setupConfigDetected: 'Config detected',
    setupWhereWrite: 'Where do you want to write Claude Code hook settings?',
    setupSecurityBehave: 'How should claude-security behave when it detects a risk?',
    setupSecurityWarn: 'Warn only (recommended to start)',
    setupSecurityBlock: 'Block (exit 2) (may interrupt workflows)',
    setupSecretsBehave: 'How should claude-secrets behave when it detects secret-like tokens?',
    setupSecretsWarn: 'Warn only (recommended to start)',
    setupSecretsBlock: 'Block private-key findings (exit 2) (HIGH only)',
    setupWhichEvents: 'Which events should be guarded?',
    setupApplyRemove: 'Apply or remove?',
    setupApply: 'Apply (write settings)',
    setupRemoveSecurity: 'Remove all claude-security hooks',
    setupRemoveSecrets: 'Remove all claude-secrets hooks',
    setupExit: 'Exit (no changes)',
    setupWriting: 'Writing settings...',
    setupConfigSaved: 'Config saved to',
  },

  ko: {
    cancelled: '취소됨',
    bye: '종료',
    noChangesWritten: '변경 사항이 저장되지 않았습니다',
    done: '완료',
    error: '오류',
    back: '뒤로',
    apply: '적용',
    exit: '종료',
    remove: '제거',
    recommended: '(권장)',
    disabled: '비활성화',

    cliUsage: `claude-code-hooks

사용법:
  npx @claude-code-hooks/cli@latest [옵션]

옵션:
  -h, --help    도움말 표시
  --ko          한국어 UI 사용 (--lang ko와 동일)
  --lang <코드> 언어 설정 (en, ko). 기본값: en

참고:
  - 이 마법사는 Claude Code 설정(전역)을 업데이트하거나 프로젝트 전용 설정 + 스니펫을 생성할 수 있습니다.`,
    cliStep1Action: '작업',
    cliStep2Target: '대상',
    cliStep3Packages: '패키지',
    cliStep4Configure: '설정',
    cliStep5Review: '검토',
    cliActionSetup: '패키지 설정 / 활성화',
    cliActionUninstall: '설치된 훅 제거',
    cliActionExit: '종료',
    cliTargetGlobal: '전역 (기본): ~/.claude/settings.json',
    cliTargetProjectOnly: '프로젝트 전용: {config} 작성 + 스니펫 출력',
    cliTargetBack: '뒤로',
    cliPkgSecurity: '@claude-code-hooks/security',
    cliPkgSecurityHint: '위험한 명령 경고/차단',
    cliPkgSecrets: '@claude-code-hooks/secrets',
    cliPkgSecretsHint: '시크릿 유사 토큰 감지',
    cliPkgSound: '@claude-code-hooks/sound',
    cliPkgSoundHint: 'Events 시 사운드 재생',
    cliPkgNotification: '@claude-code-hooks/notification',
    cliPkgNotificationHint: 'Events 시 OS 알림',
    cliContinue: '선택한 패키지를 설정하시겠습니까?',
    cliSnippetPrompt: '스니펫 파일을 {path}에 작성하시겠습니까?',
    cliWroteSnippet: '스니펫 작성됨',
    cliPasteSnippet: '~/.claude/settings.json에 붙여넣기',
    cliReviewAction: '작업',
    cliReviewTarget: '대상',
    cliReviewGlobal: '전역 설정',
    cliReviewProjectOnly: '프로젝트 전용',
    cliReviewPackages: '패키지',
    cliReviewFiles: '파일',
    cliApply: '적용하시겠습니까?',
    cliWritingProject: '프로젝트 설정 작성 중...',
    cliProjectConfigWritten: '프로젝트 설정 작성됨',
    cliApplyingGlobal: '전역 설정에 변경 사항 적용 중...',
    cliSaved: '저장됨',
    cliConfigureSummary: '설정',
    cliRemoveManagedHooks: '관리 대상 훅 제거',
    cliEventCount: '개 이벤트',
    cliCouldNotRead: 'JSON을 읽거나 파싱할 수 없습니다: {path}',

    securityFoundConfig: '기존 claude-code-hooks.config.json이 있습니다. 기본값으로 채웁니다.',
    securityHowBehave: '위험을 감지했을 때 어떻게 동작할까요?',
    securityWarn: '경고만',
    securityBlock: 'PreToolUse에서만 차단 (exit 2)',
    securityWhichEvents: '어떤 이벤트를 보호할까요?',
    securityBeforeTool: '도구 실행 전',
    securityToolPermission: '도구가 권한 요청',

    securitySuppressedAllow: 'claude-code-hooks.config.json의 allow 패턴으로 위험 비표시됨',
    securitySuppressedIgnore: 'claude-code-hooks.config.json의 ignore 패턴으로 위험 비표시됨',
    securityNoRisks: '휴리스틱으로 감지된 위험 없음.',
    securityDetectedRisks: '{n}건의 잠재적 위험 감지:',
    securityNoteHeuristic: '참고: 휴리스틱 전용입니다. 놓치는 위험이 있거나 오탐이 있을 수 있습니다. 설정에서 warn/block을 구성하세요.',
    securityBlocked: 'claude-security에 의해 차단됨 (mode=block).',

    'security.risk.rm-rf.title': '파괴적 삭제 (rm -rf)',
    'security.risk.rm-rf.detail': 'rm -rf / rm -fr 명령이 포함되어 있습니다.',
    'security.risk.pipe-to-shell.title': '네트워크를 셸로 파이프',
    'security.risk.pipe-to-shell.detail': 'curl|bash 또는 wget|sh 패턴이 감지되었습니다.',
    'security.risk.chmod-777.title': '과도한 chmod 777',
    'security.risk.chmod-777.detail': 'chmod 777이 감지되었습니다.',
    'security.risk.ssh-write.title': 'SSH 설정/키 쓰기 가능성',
    'security.risk.ssh-write.detail': '명령어에 ~/.ssh 및 키/설정 파일이 포함되어 있습니다.',
    'security.risk.git-push-main.title': 'main/master로 git push',
    'security.risk.git-push-main.detail': 'main/master로 git push가 감지되었습니다.',
    'security.risk.chown-root.title': 'root 관련 chown',
    'security.risk.chown-root.detail': 'root를 대상으로 하는 chown이 감지되었습니다.',
    'security.risk.sudo.title': 'sudo 사용',
    'security.risk.sudo.detail': '명령어에 sudo가 포함되어 있습니다.',

    secretsFoundConfig: '기존 claude-code-hooks.config.json이 있습니다. 기본값으로 채웁니다.',
    secretsHowBehave: '시크릿 유사 토큰을 감지했을 때 어떻게 동작할까요?',
    secretsWarn: '경고만',
    secretsBlock: 'HIGH만 차단 (개인키 등)',
    secretsWhichEvents: '어떤 이벤트를 스캔할까요?',
    secretsScanGitCommit: 'git commit 시 스테이징된 파일에서 시크릿 스캔?',

    secretsSuppressedAllow: 'claude-code-hooks.config.json의 allow 패턴으로 발견 비표시됨',
    secretsSuppressedIgnore: 'claude-code-hooks.config.json의 ignore 패턴으로 발견 비표시됨',
    secretsNoFindings: '휴리스틱으로 감지된 시크릿 없음.',
    secretsDetected: '{n}건의 잠재적 시크릿 감지:',
    secretsTip: '팁: 시크릿은 환경 변수나 시크릿 매니저로 옮기고, 개인키나 장기 토큰을 도구 입력에 붙여넣지 마세요.',
    secretsBlocked: 'claude-secrets에 의해 차단됨 (HIGH 신뢰도 시크릿).',

    'secrets.finding.private-key.title': '개인키 자료',
    'secrets.finding.private-key.detail': '개인키 헤더(BEGIN ... PRIVATE KEY)가 감지되었습니다.',
    'secrets.finding.openai.title': 'OpenAI API 키 유사 토큰',
    'secrets.finding.openai.detail': 'sk-... 패턴의 토큰이 감지되었습니다.',
    'secrets.finding.github.title': 'GitHub 토큰 유사 시크릿',
    'secrets.finding.github.detail': 'GitHub 토큰 패턴(ghp_ / github_pat_)이 감지되었습니다.',
    'secrets.finding.aws-akid.title': 'AWS Access Key ID 유사 토큰',
    'secrets.finding.aws-akid.detail': 'AWS access key id 패턴(AKIA...)이 감지되었습니다.',
    'secrets.finding.slack.title': 'Slack 토큰 유사 시크릿',
    'secrets.finding.slack.detail': 'Slack 토큰 패턴(xox*)이 감지되었습니다.',

    soundPickEvents: '이벤트를 선택하고 각각에 사운드를 지정하세요. (최소한으로 설정해도 됩니다.)',
    soundLegendStandalone: '힌트는 의미를 표시합니다. "inherited"는 ~/.claude/settings.json에 이미 설정된 것입니다.',
    soundLegendUmbrella: '힌트는 의미(및 상속)를 표시합니다.',
    soundWhichEvents: '어떤 이벤트에서 사운드를 재생할까요?',
    soundCategoryFor: '카테고리 선택',
    soundFor: '사운드 선택',
    soundCommon: '일반',
    soundGame: '게임',
    soundRing: '벨',
    soundCustom: '사용자 정의',
    soundInherited: '상속됨',
    soundWhereWrite: 'Claude Code 훅 설정을 어디에 작성할까요?',
    soundScopeProject: '프로젝트 (공유): .claude/settings.json',
    soundScopeProjectLocal: '프로젝트 (로컬): .claude/settings.local.json (gitignored)',
    soundScopeGlobal: '전역: ~/.claude/settings.json',
    soundInfoInherited: '"(from global)" 또는 "(from project)" 표시된 이벤트는 상위 설정을 사용합니다. 여기서 설정하면 덮어씁니다.',
    soundApply: '적용 (설정 저장)',
    soundRemoveAll: '모든 claude-sound 훅 제거',
    soundExitNoChanges: '종료 (변경 없음)',
    soundGrayInherited: '· 회색 = 상속됨',
    soundCleared: '모든 claude-sound 매핑이 초기화되었습니다 (아직 저장되지 않음). 적용을 선택해 저장하세요.',
    soundWriting: '설정 저장 중...',
    soundSavedHooks: '훅 저장됨:',
    soundEventChange: '사운드 변경',
    soundEventEnable: '활성화 및 사운드 선택',
    soundEventDisable: '비활성화 (매핑 제거)',
    soundPickCategory: '카테고리 선택',
    soundPathToFile: 'MP3 또는 WAV 파일 경로',
    soundPathPlaceholder: './my-sound.mp3 또는 /path/to/sound.wav',
    soundPathEmpty: '경로를 입력해 주세요',
    soundImporting: '가져오는 중...',
    soundImported: '가져와서 선택됨',
    soundFailed: '실패',
    soundLanguage: '음성 언어',
    soundLangEn: '영어 (기본)',
    soundLangKo: '한국어',
    soundEnterText: '음성으로 변환할 텍스트 입력',
    soundTextPlaceholder: 'Claude is ready!',
    soundTextPlaceholderKo: '클로드가 준비됐어요!',
    soundTextEmpty: '텍스트를 입력해 주세요',
    soundTextTooLong: '200자 이내로 입력하세요',
    soundGenerating: '음성 생성 중...',
    soundCreated: '생성 후 선택됨',
    soundPickSound: '사운드 선택',
    soundEscBack: '(ESC: 뒤로)',
    soundPreviewKeys: '(↑/↓ 미리듣기)',
    soundMissingSound: '--sound <id> 없음',
    soundPlayFailed: "사운드 '{id}' 재생 실패: {err}",
    soundImportMissing: '경로가 없습니다. 사용법: claude-sound import <mp3-or-wav-경로>',
    soundImportFailed: '가져오기 실패: {err}',

    'sound.ev.SessionStart': '새 세션 시작',
    'sound.ev.UserPromptSubmit': '사용자가 프롬프트 전송',
    'sound.ev.PreToolUse': '도구 실행 전',
    'sound.ev.PermissionRequest': '도구가 권한 요청',
    'sound.ev.PostToolUse': '도구 실행 완료',
    'sound.ev.PostToolUseFailure': '도구 실행 실패',
    'sound.ev.Notification': 'Claude 알림 전송',
    'sound.ev.SubagentStart': '하위 에이전트 시작',
    'sound.ev.SubagentStop': '하위 에이전트 종료',
    'sound.ev.Stop': 'Claude 응답 중지',
    'sound.ev.TeammateIdle': '팀원 대기 상태',
    'sound.ev.TaskCompleted': '작업 완료',
    'sound.ev.PreCompact': '컨텍스트 압축 전',
    'sound.ev.SessionEnd': '세션 종료',

    notificationPickEvents: 'OS 알림을 표시할 이벤트를 선택하세요. (최소한으로 설정해도 됩니다.)',
    notificationHeadless: '원격/헤드리스 환경에서는 알림이 동작하지 않으며 stdout으로 대체됩니다.',
    notificationWhichEvents: '어떤 이벤트에서 OS 알림을 표시할까요?',
    'notification.ev.SessionStart': '세션 시작 또는 재개',
    'notification.ev.UserPromptSubmit': '프롬프트 전송',
    'notification.ev.PreToolUse': '도구 실행 전',
    'notification.ev.PermissionRequest': '권한 대화상자 표시',
    'notification.ev.PostToolUse': '도구 호출 성공',
    'notification.ev.PostToolUseFailure': '도구 호출 실패',
    'notification.ev.Notification': 'Claude Code 알림 전송',
    'notification.ev.SubagentStart': '하위 에이전트 시작',
    'notification.ev.SubagentStop': '하위 에이전트 종료',
    'notification.ev.Stop': 'Claude 응답 완료',
    'notification.ev.TeammateIdle': '팀원 대기 직전',
    'notification.ev.TaskCompleted': '작업 완료 표시',
    'notification.ev.PreCompact': '컨텍스트 압축 전',
    'notification.ev.SessionEnd': '세션 종료',

    setupConfigDetected: '설정 감지됨',
    setupWhereWrite: 'Claude Code 훅 설정을 어디에 작성할까요?',
    setupSecurityBehave: 'claude-security가 위험을 감지했을 때 어떻게 동작할까요?',
    setupSecurityWarn: '경고만 (처음에는 권장)',
    setupSecurityBlock: '차단 (exit 2) (워크플로우가 중단될 수 있음)',
    setupSecretsBehave: 'claude-secrets가 시크릿 유사 토큰을 감지했을 때 어떻게 동작할까요?',
    setupSecretsWarn: '경고만 (처음에는 권장)',
    setupSecretsBlock: '개인키 발견 시 차단 (exit 2) (HIGH만)',
    setupWhichEvents: '어떤 이벤트를 보호할까요?',
    setupApplyRemove: '적용 또는 제거?',
    setupApply: '적용 (설정 저장)',
    setupRemoveSecurity: '모든 claude-security 훅 제거',
    setupRemoveSecrets: '모든 claude-secrets 훅 제거',
    setupExit: '종료 (변경 없음)',
    setupWriting: '설정 저장 중...',
    setupConfigSaved: '설정 저장됨:',
  },
};

const SUPPORTED_LOCALES = ['en', 'ko'];

/**
 * Resolve locale from flag. Accepts 'en', 'ko'. Falls back to 'en'.
 * @param {string} [code]
 * @returns {'en'|'ko'}
 */
export function resolveLocale(code) {
  if (code === 'ko') return 'ko';
  return 'en';
}

/**
 * Parse --ko or --lang <code> from argv. Returns 'en' or 'ko'.
 * @param {string[]} argv
 * @returns {'en'|'ko'}
 */
export function parseLocaleFromArgv(argv) {
  if (argv.includes('--ko')) return 'ko';
  const idx = argv.indexOf('--lang');
  if (idx !== -1 && argv[idx + 1]) return resolveLocale(argv[idx + 1]);
  return 'en';
}

/**
 * Translate a key. Supports {placeholder} substitution.
 * @param {string} key
 * @param {'en'|'ko'} [locale]
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
export function t(key, locale = 'en', vars = {}) {
  const lang = SUPPORTED_LOCALES.includes(locale) ? locale : 'en';
  const str = (STRINGS[lang] && STRINGS[lang][key]) || (STRINGS.en && STRINGS.en[key]) || key;
  let out = str;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return out;
}
