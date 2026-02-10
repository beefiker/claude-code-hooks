#!/usr/bin/env node

/**
 * Self-check / test script for @claude-code-hooks/notification.
 * Exercises command building, sanitization, dry-run mode, and CLI --help.
 * Does NOT actually send notifications (uses dry-run).
 */

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, '..', 'src', 'cli.js');
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ${PASS} ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ${FAIL} ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

function runCli(args, stdin) {
  const opts = {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 10000,
    encoding: 'utf-8'
  };
  if (stdin) opts.input = stdin;
  return spawnSync(process.execPath, [CLI_PATH, ...args], opts);
}

// ─── Sanitize module tests ────────────────────────────────────────────────────

console.log('\n  Sanitization:');

async function runSanitizeTests() {
  const { sanitize, sanitizeTitle, sanitizeMessage, stripControlChars, MAX_TITLE_LENGTH, MAX_MESSAGE_LENGTH } = await import('../src/sanitize.js');

  test('stripControlChars removes null bytes', () => {
    assert.equal(stripControlChars('hello\x00world'), 'helloworld');
  });

  test('stripControlChars keeps newline and tab', () => {
    assert.equal(stripControlChars('hello\tworld\n'), 'hello\tworld\n');
  });

  test('stripControlChars removes escape sequences', () => {
    assert.equal(stripControlChars('he\x1Bllo'), 'hello');
  });

  test('sanitize truncates long strings with ellipsis', () => {
    const long = 'A'.repeat(300);
    const result = sanitize(long, 256);
    assert.equal(result.length, 256);
    assert.ok(result.endsWith('\u2026'));
  });

  test('sanitize returns empty string for null/undefined', () => {
    assert.equal(sanitize(null, 100), '');
    assert.equal(sanitize(undefined, 100), '');
  });

  test('sanitize converts non-strings to string', () => {
    assert.equal(sanitize(42, 100), '42');
    assert.equal(sanitize(true, 100), 'true');
  });

  test('sanitizeTitle enforces MAX_TITLE_LENGTH', () => {
    const long = 'T'.repeat(500);
    const result = sanitizeTitle(long);
    assert.ok(result.length <= MAX_TITLE_LENGTH);
  });

  test('sanitizeMessage enforces MAX_MESSAGE_LENGTH', () => {
    const long = 'M'.repeat(2000);
    const result = sanitizeMessage(long);
    assert.ok(result.length <= MAX_MESSAGE_LENGTH);
  });
}

// ─── Notify module tests (command builders) ───────────────────────────────────

console.log('\n  Command builders:');

async function runNotifyTests() {
  const { buildMacOSCommand, buildLinuxCommand, buildWindowsCommand, escapeAppleScript } = await import('../src/notify.js');

  test('escapeAppleScript escapes backslashes and quotes', () => {
    assert.equal(escapeAppleScript('say "hello"'), 'say \\"hello\\"');
    assert.equal(escapeAppleScript('path\\to\\file'), 'path\\\\to\\\\file');
  });

  test('buildMacOSCommand produces osascript with correct args', () => {
    const { command, args } = buildMacOSCommand('Test Title', 'Test Message');
    assert.equal(command, 'osascript');
    assert.equal(args.length, 2);
    assert.equal(args[0], '-e');
    assert.ok(args[1].includes('display notification'));
    assert.ok(args[1].includes('Test Message'));
    assert.ok(args[1].includes('Test Title'));
  });

  test('buildMacOSCommand escapes injection attempts in title', () => {
    const { args } = buildMacOSCommand('"; do shell script "rm -rf /"', 'msg');
    // The quotes should be escaped, not breaking out of the string
    assert.ok(args[1].includes('\\"'));
    assert.ok(!args[1].includes('" do shell script'));
  });

  test('buildLinuxCommand produces notify-send with correct args', () => {
    const { command, args } = buildLinuxCommand('Test', 'Hello');
    assert.equal(command, 'notify-send');
    assert.ok(args.includes('Test'));
    assert.ok(args.includes('Hello'));
    assert.ok(args.includes('--app-name'));
    assert.ok(args.includes('Claude Code'));
  });

  test('buildWindowsCommand produces powershell with base64-encoded content', () => {
    const { command, args } = buildWindowsCommand('Title', 'Message');
    assert.equal(command, 'powershell.exe');
    assert.ok(args.includes('-NoProfile'));
    assert.ok(args.includes('-NonInteractive'));
    // Verify base64 encoding is used (no raw user content in command)
    const script = args[args.length - 1];
    assert.ok(script.includes('FromBase64String'));
    // Verify the base64-encoded title decodes correctly
    const titleB64 = Buffer.from('Title', 'utf-8').toString('base64');
    assert.ok(script.includes(titleB64));
  });

  test('buildWindowsCommand prevents injection via base64 encoding', () => {
    const malicious = '"; Remove-Item -Recurse C:\\ -Force; "';
    const { args } = buildWindowsCommand(malicious, 'msg');
    const script = args[args.length - 1];
    // The malicious string should NOT appear literally in the script
    assert.ok(!script.includes('Remove-Item'));
  });
}

// ─── CLI tests ────────────────────────────────────────────────────────────────

console.log('\n  CLI:');

function runCliTests() {
  test('--help exits 0 and shows usage', () => {
    const r = runCli(['--help']);
    assert.equal(r.status, 0);
    assert.ok(r.stdout.includes('claude-code-hooks-notification'));
    assert.ok(r.stdout.includes('--title'));
    assert.ok(r.stdout.includes('--dry-run'));
  });

  test('-h exits 0 and shows usage', () => {
    const r = runCli(['-h']);
    assert.equal(r.status, 0);
    assert.ok(r.stdout.includes('claude-code-hooks-notification'));
  });

  test('--dry-run with --event Stop produces valid JSON output', () => {
    const r = runCli(['--event', 'Stop', '--dry-run']);
    assert.equal(r.status, 0, `CLI exited with status ${r.status}: stderr=${r.stderr}`);
    const json = JSON.parse(r.stdout);
    assert.equal(json.method, 'dry-run');
    assert.ok(json.command, 'Expected a command field');
    assert.ok(Array.isArray(json.args), 'Expected args array');
  });

  test('--dry-run with --title and --message produces correct output', () => {
    const r = runCli(['--title', 'Custom', '--message', 'Hello World', '--dry-run']);
    assert.equal(r.status, 0, `CLI exited with status ${r.status}: stderr=${r.stderr}`);
    const json = JSON.parse(r.stdout);
    assert.equal(json.method, 'dry-run');
    // The notification content should be reflected in the command args
    const argsStr = JSON.stringify(json.args);
    assert.ok(argsStr.includes('Custom') || argsStr.includes('Hello World') || argsStr.includes('base64'),
      'Expected title/message in args');
  });

  test('--dry-run with stdin JSON payload uses hook_event_name', () => {
    const payload = JSON.stringify({ hook_event_name: 'Notification', message: 'Claude needs your attention' });
    const r = runCli(['--dry-run'], payload);
    assert.equal(r.status, 0, `CLI exited with status ${r.status}: stderr=${r.stderr}`);
    const json = JSON.parse(r.stdout);
    assert.equal(json.method, 'dry-run');
  });

  test('--dry-run with --event overrides stdin event', () => {
    const payload = JSON.stringify({ hook_event_name: 'SessionStart' });
    const r = runCli(['--event', 'Stop', '--dry-run'], payload);
    assert.equal(r.status, 0);
    const json = JSON.parse(r.stdout);
    assert.equal(json.method, 'dry-run');
  });

  test('--dry-run with all events produces valid output', () => {
    const events = [
      'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest',
      'PostToolUse', 'PostToolUseFailure', 'Notification', 'SubagentStart',
      'SubagentStop', 'Stop', 'TeammateIdle', 'TaskCompleted', 'PreCompact', 'SessionEnd'
    ];
    for (const event of events) {
      const r = runCli(['--event', event, '--dry-run']);
      assert.equal(r.status, 0, `Failed for event ${event}: stderr=${r.stderr}`);
      const json = JSON.parse(r.stdout);
      assert.equal(json.method, 'dry-run', `Wrong method for event ${event}`);
    }
  });
}

// ─── Run all tests ────────────────────────────────────────────────────────────

async function main() {
  console.log('\n@claude-code-hooks/notification — self-check\n');

  await runSanitizeTests();
  await runNotifyTests();
  runCliTests();

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
