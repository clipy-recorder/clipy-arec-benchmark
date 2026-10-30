import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { sanitizeText } from './artifact-privacy.mjs';

const GENERIC_SECRET_PATTERNS = [
  /-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----/g,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/gi,
  /\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{16,}/gi,
];

function genericSecretMatches(value) {
  return GENERIC_SECRET_PATTERNS.flatMap((pattern) =>
    [...value.matchAll(pattern)].map((match) => match[0]));
}

export function stringSecrets(value) {
  if (typeof value === 'string') return value.length >= 8 ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(stringSecrets);
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringSecrets);
  return [];
}

function materialFindings(value, credentialSecrets, canary) {
  const genericSecrets = genericSecretMatches(value);
  return {
    canary: value.includes(canary),
    credential: credentialSecrets.some((secret) => value.includes(secret)),
    genericSecrets,
  };
}

export async function scanSubmission(root, credentialSecrets, canary, identity) {
  const secretPaths = new Set();
  const canaryPaths = new Set();
  const hostMaterialPaths = new Set();
  const genericSecrets = new Set();
  let unsafeEntryCount = 0;

  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'evidence') continue;
      const path = join(directory, entry.name);
      const displayPath = relative(root, path);
      const nameFindings = materialFindings(displayPath, credentialSecrets, canary);
      const namePrivacy = sanitizeText(displayPath, identity);
      if (nameFindings.canary) canaryPaths.add(path);
      if (nameFindings.credential || nameFindings.genericSecrets.length) secretPaths.add(path);
      if (namePrivacy.hostIdentityRedactionCount || namePrivacy.hostPathRedactionCount) {
        hostMaterialPaths.add(path);
      }
      nameFindings.genericSecrets.forEach((secret) => genericSecrets.add(secret));

      if (entry.isDirectory()) {
        await scan(path);
        continue;
      }
      if (!entry.isFile()) {
        unsafeEntryCount += 1;
        continue;
      }

      const bytes = await readFile(path);
      if (bytes.includes(Buffer.from(canary))) canaryPaths.add(path);
      if (credentialSecrets.some((secret) => bytes.includes(Buffer.from(secret)))) secretPaths.add(path);
      const content = bytes.toString('utf8');
      const contentSecrets = genericSecretMatches(content);
      const contentPrivacy = sanitizeText(content, identity);
      if (contentSecrets.length) secretPaths.add(path);
      if (contentPrivacy.hostIdentityRedactionCount || contentPrivacy.hostPathRedactionCount) {
        hostMaterialPaths.add(path);
      }
      contentSecrets.forEach((secret) => genericSecrets.add(secret));
    }
  }

  await scan(root);
  return {
    canaryPathCount: canaryPaths.size,
    genericSecrets: [...genericSecrets],
    hostMaterialPathCount: hostMaterialPaths.size,
    secretPathCount: secretPaths.size,
    unsafeEntryCount,
  };
}

export function protectArtifacts(material, credentialSecrets, canary, submissionScan) {
  const outputSecrets = material.flatMap(genericSecretMatches);
  const genericSecrets = [...new Set([...outputSecrets, ...submissionScan.genericSecrets])];
  const secretValues = [...new Set([...credentialSecrets, ...genericSecrets])].filter(Boolean);
  const secretLeakDetected = material.some((value) =>
    secretValues.some((secret) => value.includes(secret))) || submissionScan.secretPathCount > 0;
  const leakageDetected = material.some((value) => value.includes(canary))
    || submissionScan.canaryPathCount > 0;

  const redact = (value) => {
    let redacted = value.replaceAll(canary, '[REDACTED_BENCHMARK_CANARY]');
    for (const secret of secretValues) {
      redacted = redacted.replaceAll(secret, '[REDACTED_AUTH_SECRET]');
    }
    return redacted;
  };

  return {
    leakageDetected,
    redact,
    secretLeakDetected,
    withholdSubmission: leakageDetected
      || secretLeakDetected
      || submissionScan.hostMaterialPathCount > 0
      || submissionScan.unsafeEntryCount > 0,
  };
}
