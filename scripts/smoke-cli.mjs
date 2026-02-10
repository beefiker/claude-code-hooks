import { spawnSync } from 'node:child_process';

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

// Basic non-interactive checks: just ensure binaries start and help works.
run('node', ['packages/security/src/cli.js', '--help']);
run('node', ['packages/secrets/src/cli.js', '--help']);
run('node', ['packages/sound/src/cli.js', '--help']);
run('node', ['packages/cli/src/cli.js', '--help']);
run('node', ['packages/notification/src/cli.js', '--help']);

console.log('Smoke OK');
