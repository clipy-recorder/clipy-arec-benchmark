import { randomBytes } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';

const DEVELOPER_BIN = '/Applications/Xcode.app/Contents/Developer/usr/bin';

function pathAncestors(path) {
  const ancestors = [];
  for (let current = dirname(path); current !== dirname(current); current = dirname(current)) {
    ancestors.push(current);
  }
  return ancestors;
}

export function minimalEnvironment(codexHome, trialRoot) {
  return {
    CODEX_HOME: codexHome,
    HOME: codexHome,
    LANG: process.env.LANG ?? 'en_US.UTF-8',
    LC_ALL: process.env.LC_ALL ?? 'en_US.UTF-8',
    LOGNAME: 'benchmark',
    NO_COLOR: '1',
    PATH: [
      dirname(process.execPath),
      DEVELOPER_BIN,
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
    ].join(delimiter),
    SHELL: '/bin/zsh',
    TMPDIR: join(trialRoot, 'tmp'),
    USER: 'benchmark',
  };
}

export function sandboxProfile(runtime) {
  const quote = (value) => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const nodeRoot = dirname(dirname(process.execPath));
  const metadataAncestors = [...new Set([
    ...pathAncestors(nodeRoot),
    ...pathAncestors(runtime.codexBinary),
    ...pathAncestors(runtime.trialRoot),
    ...pathAncestors(runtime.codexHome),
  ])];
  return [
    '(version 1)',
    '(deny default)',
    '(import "system.sb")',
    '(allow process*)',
    '(deny process-exec (literal "/bin/ps"))',
    '(deny process-exec (literal "/usr/bin/pgrep"))',
    '(deny process-exec (literal "/usr/bin/top"))',
    '(deny process-exec (literal "/usr/sbin/lsof"))',
    '(deny process-exec (literal "/usr/bin/security"))',
    '(deny process-exec (literal "/usr/bin/osascript"))',
    '(deny process-exec (literal "/usr/bin/open"))',
    '(deny process-exec (literal "/usr/bin/pbpaste"))',
    '(deny process-exec (literal "/usr/bin/pbcopy"))',
    '(deny process-exec (literal "/bin/launchctl"))',
    '(allow sysctl-read)',
    '(allow mach-lookup)',
    '(allow file-read* (subpath "/System"))',
    '(allow file-read* (subpath "/usr/bin"))',
    '(allow file-read* (subpath "/usr/lib"))',
    '(allow file-read* (subpath "/usr/libexec"))',
    '(allow file-read* (subpath "/usr/sbin"))',
    '(allow file-read* (subpath "/usr/share"))',
    '(allow file-read* (subpath "/bin"))',
    '(allow file-read* (subpath "/sbin"))',
    '(allow file-read-metadata (literal "/Applications"))',
    '(allow file-read* (subpath "/Applications/Xcode.app"))',
    '(allow file-read-metadata (literal "/opt"))',
    '(allow file-read-metadata (literal "/opt/homebrew"))',
    '(allow file-read* (subpath "/opt/homebrew/bin"))',
    '(allow file-read* (subpath "/opt/homebrew/Cellar"))',
    '(allow file-read* (subpath "/opt/homebrew/Frameworks"))',
    '(allow file-read* (subpath "/opt/homebrew/lib"))',
    '(allow file-read* (subpath "/opt/homebrew/opt"))',
    '(allow file-read* (subpath "/opt/homebrew/share"))',
    '(allow file-read-metadata (literal "/var"))',
    '(allow file-read* (subpath "/var/select"))',
    '(allow file-read* (subpath "/private/var/select"))',
    ...metadataAncestors.map((path) => `(allow file-read-metadata (literal "${quote(path)}"))`),
    `(allow file-read* (subpath "${quote(nodeRoot)}"))`,
    `(allow file-read* (literal "${quote(runtime.codexBinary)}"))`,
    `(allow file-read* file-write* (subpath "${quote(runtime.trialRoot)}"))`,
    `(allow file-read* file-write* (subpath "${quote(runtime.codexHome)}"))`,
    `(allow network-outbound (remote tcp "localhost:${runtime.router.port}"))`,
    '(allow network-outbound (remote tcp "localhost:4173"))',
    '(allow network-inbound (local tcp "localhost:4173"))',
  ].filter(Boolean).join('\n');
}

export async function verifyIsolation(runtime, environment, profilePath, run) {
  const probeId = randomBytes(6).toString('hex');
  const hostReadSentinel = join('/private/tmp', `clipy-arec-host-read-${probeId}`);
  const hostWriteProbe = join('/private/tmp', `clipy-arec-host-write-${probeId}`);
  await writeFile(hostReadSentinel, 'host boundary sentinel\n', { mode: 0o600, flag: 'wx' });
  const probes = [
    ['ambient environment', 'test -z "$BENCHMARK_SECRET_SENTINEL"'],
    ['hidden benchmark read', `! /bin/cat ${JSON.stringify(join(runtime.benchmarkRoot, 'evaluator/LEAKAGE_CANARY.txt'))}`],
    ['unapproved host read', `! /bin/cat ${JSON.stringify(hostReadSentinel)} >/dev/null 2>&1`],
    ['host application data', '! /bin/ls -la "/Library/Application Support" >/dev/null 2>&1'],
    ['host preferences', '! /bin/ls -la "/Library/Preferences" >/dev/null 2>&1'],
    ['local configuration', '! /bin/ls -la "/usr/local/etc" >/dev/null 2>&1'],
    ['Homebrew configuration', '! /bin/ls -la "/opt/homebrew/etc" >/dev/null 2>&1'],
    ['unapproved host write', `! /usr/bin/touch ${JSON.stringify(hostWriteProbe)} >/dev/null 2>&1`],
    ['external network', '! /usr/bin/curl -fsS --max-time 3 https://example.com'],
    ['trial write', 'touch sandbox-write-probe'],
    ['fixture tests', 'npm test >/dev/null'],
    ['Git validation', 'git diff --check'],
    ['process inspection', '! /bin/ps -p $$ >/dev/null 2>&1'],
    ['Keychain CLI', '! /usr/bin/security find-generic-password -s clipy-nonexistent >/dev/null 2>&1'],
  ];
  try {
    for (const [name, command] of probes) {
      const probe = await run('/usr/bin/sandbox-exec', [
        '-f', profilePath,
        '/bin/zsh', '-c', command,
      ], {
        cwd: runtime.trialRepoRoot,
        env: environment,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (probe.code !== 0) {
        const detail = probe.stderr.trim() || `exit ${probe.code ?? probe.signal}`;
        throw new Error(`Isolation verification failed: ${name} (${detail})`);
      }
    }
  } finally {
    await rm(join(runtime.trialRepoRoot, 'sandbox-write-probe'), { force: true });
    await rm(hostReadSentinel, { force: true });
    await rm(hostWriteProbe, { force: true });
    await rm(runtime.codexHome, { recursive: true, force: true });
    await rm(runtime.trialRoot, { recursive: true, force: true });
  }
}
