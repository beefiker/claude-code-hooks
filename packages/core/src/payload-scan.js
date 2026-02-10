function collectStrings(obj, out) {
  if (!obj) return;
  if (typeof obj === 'string') {
    out.push(obj);
    return;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) collectStrings(v, out);
    return;
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) collectStrings(v, out);
  }
}

/**
 * Build combined text to scan from a hook payload.
 * @param {Record<string, unknown>} payload
 */
export function buildCombinedText(payload) {
  const strings = [];
  collectStrings(payload, strings);

  const likely = [];
  if (payload && typeof payload === 'object') {
    for (const k of ['command', 'cmd', 'shell', 'tool', 'tool_name', 'toolName', 'input', 'arguments', 'args', 'reason']) {
      if (k in payload) likely.push(payload[k]);
    }
  }

  const textsToScan = [...likely, ...strings];
  return textsToScan.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n');
}
