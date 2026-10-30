const HOST_HOME_PATTERNS = [
  /\/(?:Users|home)\/[A-Za-z0-9._-]+/g,
  /[A-Za-z]:\\Users\\[^\\/"'\s]+/gi,
];

export const NON_STUDY_GLOBAL_CONTENT_MARKER = '[REDACTED_NON_STUDY_GLOBAL_CONTENT]\n';

function redactHostPaths(value) {
  let redacted = value;
  let count = 0;
  for (const pattern of HOST_HOME_PATTERNS) {
    redacted = redacted.replace(pattern, () => {
      count += 1;
      return '[REDACTED_HOME]';
    });
  }
  return { count, value: redacted };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactHostIdentity(value, identity = {}) {
  let redacted = value;
  let count = 0;
  if (identity.accountName) {
    const account = escapeRegExp(identity.accountName);
    const ownerPattern = new RegExp(`(^|\\s)${account}(?=\\s+(?:admin|staff|wheel)(?:\\s|$))`, 'gi');
    redacted = redacted.replace(ownerPattern, (match, prefix) => {
      count += 1;
      return `${prefix}[REDACTED_ACCOUNT]`;
    });
    const idPattern = new RegExp(`((?:uid|gid)=\\d+\\()${account}(\\))`, 'gi');
    redacted = redacted.replace(idPattern, (match, prefix, suffix) => {
      count += 1;
      return `${prefix}[REDACTED_ACCOUNT]${suffix}`;
    });
  }
  if (identity.hostname) {
    const occurrences = redacted.split(identity.hostname).length - 1;
    if (occurrences) {
      redacted = redacted.replaceAll(identity.hostname, '[REDACTED_HOSTNAME]');
      count += occurrences;
    }
  }
  return { count, value: redacted };
}

function isGlobalAgentContentCommand(command) {
  return /(?:\[REDACTED_HOME\]|\/(?:Users|home)\/[A-Za-z0-9._-]+|[A-Za-z]:\\Users\\[^\\/"'\s]+)[/\\]\.(?:agents|claude|codex)[/\\]/i.test(command)
    && /(?:SKILL\.md|[/\\]skills[/\\]|[/\\]plugins[/\\])/i.test(command);
}

function redactObjectHostMaterial(value, identity) {
  if (typeof value === 'string') {
    const paths = redactHostPaths(value);
    const hostIdentity = redactHostIdentity(paths.value, identity);
    return {
      hostIdentityCount: hostIdentity.count,
      hostPathCount: paths.count,
      value: hostIdentity.value,
    };
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => redactObjectHostMaterial(item, identity));
    return {
      hostIdentityCount: items.reduce((sum, item) => sum + item.hostIdentityCount, 0),
      hostPathCount: items.reduce((sum, item) => sum + item.hostPathCount, 0),
      value: items.map((item) => item.value),
    };
  }
  if (value && typeof value === 'object') {
    let hostIdentityCount = 0;
    let hostPathCount = 0;
    const entries = Object.entries(value).map(([key, item]) => {
      const redacted = redactObjectHostMaterial(item, identity);
      hostIdentityCount += redacted.hostIdentityCount;
      hostPathCount += redacted.hostPathCount;
      return [key, redacted.value];
    });
    return { hostIdentityCount, hostPathCount, value: Object.fromEntries(entries) };
  }
  return { hostIdentityCount: 0, hostPathCount: 0, value };
}

export function sanitizeText(value, identity) {
  const paths = redactHostPaths(value);
  const hostIdentity = redactHostIdentity(paths.value, identity);
  return {
    hostIdentityRedactionCount: hostIdentity.count,
    hostPathRedactionCount: paths.count,
    value: hostIdentity.value,
  };
}

export function sanitizeEventLog(value, identity) {
  let globalContentRedactionCount = 0;
  let hostIdentityRedactionCount = 0;
  let hostPathRedactionCount = 0;
  const trailingNewline = value.endsWith('\n');
  const lines = value.split('\n');
  if (trailingNewline) lines.pop();
  const redactedLines = lines.map((line) => {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      const redacted = sanitizeText(line, identity);
      hostIdentityRedactionCount += redacted.hostIdentityRedactionCount;
      hostPathRedactionCount += redacted.hostPathRedactionCount;
      return redacted.value;
    }

    const command = event.item?.command;
    let changed = false;
    if (
      typeof command === 'string'
      && isGlobalAgentContentCommand(command)
      && typeof event.item?.aggregated_output === 'string'
      && event.item.aggregated_output
      && event.item.aggregated_output !== NON_STUDY_GLOBAL_CONTENT_MARKER
    ) {
      event.item.aggregated_output = NON_STUDY_GLOBAL_CONTENT_MARKER;
      globalContentRedactionCount += 1;
      changed = true;
    }
    const redacted = redactObjectHostMaterial(event, identity);
    hostIdentityRedactionCount += redacted.hostIdentityCount;
    hostPathRedactionCount += redacted.hostPathCount;
    return changed || redacted.hostIdentityCount || redacted.hostPathCount
      ? JSON.stringify(redacted.value)
      : line;
  });
  return {
    globalContentRedactionCount,
    hostIdentityRedactionCount,
    hostPathRedactionCount,
    value: `${redactedLines.join('\n')}${trailingNewline ? '\n' : ''}`,
  };
}
