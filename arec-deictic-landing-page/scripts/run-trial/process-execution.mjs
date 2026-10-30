import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

export function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, options);
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code, signal) => resolveRun({ code, signal, stdout, stderr }));
  });
}

export async function executeModel(runtime, environment, profilePath) {
  const outputMessagePath = join(runtime.trialRoot, 'final-answer.md');
  const args = [
    '-f', profilePath,
    runtime.codexBinary,
    'exec',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--json',
    '--color', 'never',
    '--model', runtime.protocol.runtime.model,
    '--dangerously-bypass-approvals-and-sandbox',
    '--config', `model_reasoning_effort="${runtime.protocol.runtime.reasoningEffort}"`,
    '--config', 'model_provider="benchmark_router"',
    '--config', 'model_providers.benchmark_router.name="Benchmark router"',
    '--config', `model_providers.benchmark_router.base_url="${runtime.routerUrl}"`,
    '--config', 'model_providers.benchmark_router.wire_api="responses"',
    '--config', 'model_providers.benchmark_router.requires_openai_auth=true',
    '--config', 'model_providers.benchmark_router.supports_websockets=false',
    '--config', `model_catalog_json="${join(runtime.codexHome, 'model_catalog.json')}"`,
    '--config', 'network_access="disabled"',
    '--config', 'service_tier="default"',
    '--config', 'features.plugins=false',
    '--config', 'features.memories=false',
    '--config', 'features.skill_search=false',
    '--config', 'features.multi_agent=false',
    '--config', 'features.apps=false',
    '--config', 'features.browser_use=false',
    '--config', 'features.computer_use=false',
    '--config', 'shell_environment_policy.inherit="none"',
    '--config', 'shell_environment_policy.include_only=["PATH","LANG","LC_ALL","LOGNAME","NO_COLOR","SHELL","TMPDIR","USER"]',
    '--output-last-message', outputMessagePath,
    '--cd', runtime.trialRepoRoot,
    '-',
  ];
  const child = spawn('/usr/bin/sandbox-exec', args, {
    cwd: runtime.trialRepoRoot,
    env: environment,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let authRemoval = Promise.resolve(false);
  let authRemovalStarted = false;
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    if (!authRemovalStarted && stdout.includes('"type":"thread.started"')) {
      authRemovalStarted = true;
      authRemoval = rm(join(runtime.codexHome, 'auth.json'), { force: true }).then(() => true);
    }
  });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdin.end(runtime.commonPrompt);

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 5_000).unref();
  }, runtime.protocol.runtime.timeoutSeconds * 1000);
  const completion = await new Promise((resolveCompletion, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolveCompletion({ code, signal }));
  });
  clearTimeout(timeout);

  return {
    authRemovedAfterThreadStart: await authRemoval,
    completion,
    outputMessagePath,
    stderr,
    stdout,
    timedOut,
  };
}
