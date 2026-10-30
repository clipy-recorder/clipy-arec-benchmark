import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { access, readFile, realpath } from 'node:fs/promises';
import { hostname, userInfo } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';

const WORK_ROOT = '/private/tmp/clipy-arec-deictic-benchmark-work';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);
    const key = argument.slice(2);
    if (key === 'pilot' || key === 'verify-isolation') options[key] = true;
    else options[key] = argv[++index];
  }
  return options;
}

async function resolveExecutable(command) {
  if (command.includes('/')) return realpath(resolve(command));
  for (const directory of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    const candidate = join(directory, command);
    try {
      await access(candidate, constants.X_OK);
      return realpath(candidate);
    } catch {
      // Continue searching PATH.
    }
  }
  throw new Error(`Could not resolve executable: ${command}`);
}

export async function resolveRuntime(benchmarkRoot, argv) {
  const protocol = JSON.parse(await readFile(join(benchmarkRoot, 'protocol.json'), 'utf8'));
  const commonPrompt = await readFile(join(benchmarkRoot, protocol.commonPromptFile), 'utf8');
  const userHome = process.env.HOME;
  if (!userHome) throw new Error('HOME is required to locate Codex authentication');

  const codexHomeRoot = process.env.CODEX_HOME ?? join(userHome, '.codex');
  const codexConfigPath = process.env.CODEX_CONFIG ?? join(codexHomeRoot, 'config.toml');
  const codexConfig = await readFile(codexConfigPath, 'utf8');
  const routerUrl = codexConfig.match(/^openai_base_url\s*=\s*"([^"]+)"/m)?.[1];
  const modelCatalog = codexConfig.match(/^model_catalog_json\s*=\s*"([^"]+)"/m)?.[1];
  const router = routerUrl ? new URL(routerUrl) : null;
  const options = parseArgs(argv);
  const arm = options.arm;
  const replicate = options.replicate;

  if (!protocol.arms.includes(arm)) throw new Error(`Unknown arm: ${arm}`);
  if (!replicate) throw new Error('--replicate is required');
  if (!routerUrl || !modelCatalog) throw new Error('Codex router configuration is unavailable');
  if (!['127.0.0.1', 'localhost', '::1'].includes(router.hostname) || !router.port) {
    throw new Error('The hardened runner requires a local Codex router with an explicit port');
  }

  const codexBinary = await resolveExecutable(process.env.CODEX_BIN ?? 'codex');
  const runId = options.pilot
    ? `pilot-${arm}-${replicate}`
    : `trial-${String(replicate).padStart(2, '0')}-${arm}`;
  const trialRoot = join(WORK_ROOT, 'trials', `${runId}-${randomBytes(4).toString('hex')}`);
  const codexHome = join(WORK_ROOT, 'codex-homes', `${runId}-${randomBytes(4).toString('hex')}`);

  return {
    arm,
    authPath: join(codexHomeRoot, 'auth.json'),
    benchmarkRoot,
    codexBinary,
    codexHome,
    codexHomeRoot,
    commonPrompt,
    durableRoot: join(benchmarkRoot, 'results', options.pilot ? 'pilots' : 'trials', runId),
    hostIdentity: { accountName: userInfo().username, hostname: hostname() },
    modelCatalog,
    options,
    protocol,
    replicate,
    router,
    routerUrl,
    runId,
    trialRepoRoot: join(trialRoot, 'repo'),
    trialRoot,
  };
}
