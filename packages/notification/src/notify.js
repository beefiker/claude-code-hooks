/**
 * Cross-platform OS-level notification sender.
 *
 * - macOS:   osascript -e 'display notification ...'
 * - Linux:   notify-send (if available and DISPLAY/WAYLAND set)
 * - Windows: powershell toast via Windows Runtime (no external modules)
 *
 * Safety: never uses shell=true; all commands use spawn with explicit args.
 */

import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import process from 'node:process';
import { sanitizeTitle, sanitizeMessage } from './sanitize.js';

/**
 * @typedef {Object} NotifyOptions
 * @property {string} title   - Notification title
 * @property {string} message - Notification body/message
 * @property {boolean} [dryRun] - If true, build and return command without executing
 */

/**
 * @typedef {Object} NotifyResult
 * @property {boolean} sent       - Whether the notification was actually dispatched
 * @property {string}  method     - Which method was used: 'osascript' | 'notify-send' | 'powershell' | 'stdout' | 'dry-run'
 * @property {string}  [command]  - The command that was (or would be) executed
 * @property {string[]} [args]    - The arguments that were (or would be) passed
 * @property {string}  [fallbackReason] - Why notification fell back to stdout
 */

/**
 * Escape a string for embedding inside an AppleScript single-quoted string.
 * AppleScript uses backslash escaping inside quoted strings.
 * @param {string} str
 * @returns {string}
 */
function escapeAppleScript(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Build macOS notification via osascript.
 * @param {string} title
 * @param {string} message
 * @returns {{ command: string, args: string[] }}
 */
function buildMacOSCommand(title, message) {
  const safeTitle = escapeAppleScript(title);
  const safeMessage = escapeAppleScript(message);
  const script = `display notification "${safeMessage}" with title "${safeTitle}"`;
  return { command: 'osascript', args: ['-e', script] };
}

/**
 * Build Linux notification via notify-send.
 * @param {string} title
 * @param {string} message
 * @returns {{ command: string, args: string[] }}
 */
function buildLinuxCommand(title, message) {
  return {
    command: 'notify-send',
    args: ['--app-name', 'Claude Code', '--expire-time', '5000', title, message]
  };
}

/**
 * Build Windows notification via PowerShell toast (Windows Runtime).
 * Uses [Windows.UI.Notifications] via PowerShell — no external modules needed.
 * The XML is built programmatically and passed as a single -Command argument.
 * @param {string} title
 * @param {string} message
 * @returns {{ command: string, args: string[] }}
 */
function buildWindowsCommand(title, message) {
  // Encode title and message as base64 to avoid any PowerShell injection.
  // We decode inside PowerShell itself.
  const titleB64 = Buffer.from(title, 'utf-8').toString('base64');
  const messageB64 = Buffer.from(message, 'utf-8').toString('base64');

  // PowerShell script that decodes base64, XML-encodes, and sends toast.
  const psScript = [
    '$t=[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("' + titleB64 + '"))',
    '$m=[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("' + messageB64 + '"))',
    '$te=[System.Security.SecurityElement]::Escape($t)',
    '$me=[System.Security.SecurityElement]::Escape($m)',
    '$xml=\'<toast><visual><binding template="ToastGeneric"><text>\'+$te+\'</text><text>\'+$me+\'</text></binding></visual></toast>\'',
    '[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]|Out-Null',
    '[Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom,ContentType=WindowsRuntime]|Out-Null',
    '$xd=New-Object Windows.Data.Xml.Dom.XmlDocument',
    '$xd.LoadXml($xml)',
    '$notifier=[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Claude Code")',
    '$toast=New-Object Windows.UI.Notifications.ToastNotification($xd)',
    '$notifier.Show($toast)'
  ].join(';');

  return {
    command: 'powershell.exe',
    args: ['-NoProfile', '-NonInteractive', '-Command', psScript]
  };
}

/**
 * Check if notify-send is available on the system.
 * @returns {boolean}
 */
function hasNotifySend() {
  try {
    const result = spawnSync('which', ['notify-send'], { stdio: 'pipe', timeout: 3000 });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Check if a Linux/Unix environment can display GUI notifications.
 * @returns {boolean}
 */
function hasGuiEnvironment() {
  // Wayland
  if (process.env.WAYLAND_DISPLAY) return true;
  // X11
  if (process.env.DISPLAY) return true;
  // macOS always has a GUI (unless headless, but that's rare)
  if (os.platform() === 'darwin') return true;
  // Windows always has a GUI in interactive sessions
  if (os.platform() === 'win32') return true;
  return false;
}

/**
 * Detect if running in an SSH session (remote/headless).
 * @returns {boolean}
 */
function isRemoteSession() {
  return Boolean(process.env.SSH_CLIENT || process.env.SSH_TTY || process.env.SSH_CONNECTION);
}

/**
 * Execute a command with spawn (no shell). Returns a promise.
 * @param {string} command
 * @param {string[]} args
 * @param {number} [timeoutMs=8000]
 * @returns {Promise<{ code: number | null, stderr: string }>}
 */
function execCommand(command, args, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const stderrChunks = [];
    const child = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: timeoutMs
    });

    child.stderr.on('data', (chunk) => {
      stderrChunks.push(chunk);
    });

    child.on('error', (err) => {
      resolve({ code: null, stderr: err.message });
    });

    child.on('close', (code) => {
      resolve({ code, stderr: Buffer.concat(stderrChunks).toString('utf-8') });
    });
  });
}

/**
 * Send an OS-level notification.
 * @param {NotifyOptions} options
 * @returns {Promise<NotifyResult>}
 */
export async function sendNotification(options) {
  const title = sanitizeTitle(options.title || 'Claude Code');
  const message = sanitizeMessage(options.message || '');

  if (!message) {
    return { sent: false, method: 'stdout', fallbackReason: 'Empty message' };
  }

  const platform = os.platform();

  // Dry-run mode: build the command but don't execute
  if (options.dryRun) {
    const build = platform === 'darwin'
      ? buildMacOSCommand(title, message)
      : platform === 'linux'
        ? buildLinuxCommand(title, message)
        : platform === 'win32'
          ? buildWindowsCommand(title, message)
          : null;

    if (!build) {
      return { sent: false, method: 'dry-run', fallbackReason: `Unsupported platform: ${platform}` };
    }

    return {
      sent: false,
      method: 'dry-run',
      command: build.command,
      args: build.args
    };
  }

  // Check for GUI environment
  if (!hasGuiEnvironment()) {
    const fallback = `[notification] ${title}: ${message}`;
    process.stdout.write(fallback + '\n');
    return { sent: false, method: 'stdout', fallbackReason: 'No GUI environment (DISPLAY/WAYLAND_DISPLAY not set)' };
  }

  // Remote (SSH) sessions: fallback to stdout unless GUI forwarding is detected
  if (isRemoteSession() && platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    const fallback = `[notification] ${title}: ${message}`;
    process.stdout.write(fallback + '\n');
    return { sent: false, method: 'stdout', fallbackReason: 'Remote SSH session without display forwarding' };
  }

  // macOS
  if (platform === 'darwin') {
    const { command, args } = buildMacOSCommand(title, message);
    const result = await execCommand(command, args);
    if (result.code === 0) {
      return { sent: true, method: 'osascript', command, args };
    }
    // Fallback to stdout on failure
    const fallback = `[notification] ${title}: ${message}`;
    process.stdout.write(fallback + '\n');
    return { sent: false, method: 'stdout', fallbackReason: `osascript failed (code=${result.code}): ${result.stderr}` };
  }

  // Linux
  if (platform === 'linux') {
    if (!hasNotifySend()) {
      const fallback = `[notification] ${title}: ${message}`;
      process.stdout.write(fallback + '\n');
      return { sent: false, method: 'stdout', fallbackReason: 'notify-send not found (install libnotify-bin)' };
    }
    const { command, args } = buildLinuxCommand(title, message);
    const result = await execCommand(command, args);
    if (result.code === 0) {
      return { sent: true, method: 'notify-send', command, args };
    }
    const fallback = `[notification] ${title}: ${message}`;
    process.stdout.write(fallback + '\n');
    return { sent: false, method: 'stdout', fallbackReason: `notify-send failed (code=${result.code}): ${result.stderr}` };
  }

  // Windows
  if (platform === 'win32') {
    const { command, args } = buildWindowsCommand(title, message);
    const result = await execCommand(command, args, 15000); // PS can be slow to start
    if (result.code === 0) {
      return { sent: true, method: 'powershell', command, args };
    }
    const fallback = `[notification] ${title}: ${message}`;
    process.stdout.write(fallback + '\n');
    return { sent: false, method: 'stdout', fallbackReason: `powershell toast failed (code=${result.code}): ${result.stderr}` };
  }

  // Unsupported platform
  const fallback = `[notification] ${title}: ${message}`;
  process.stdout.write(fallback + '\n');
  return { sent: false, method: 'stdout', fallbackReason: `Unsupported platform: ${platform}` };
}

// Export builders for testing
export { buildMacOSCommand, buildLinuxCommand, buildWindowsCommand };
export { escapeAppleScript };
