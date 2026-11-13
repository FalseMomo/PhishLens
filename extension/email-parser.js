'use strict';

// Parses a Gmail API users.messages.get format=full payload.
// Authentication results are copied from headers only. Missing results stay null.

function decodeBase64Url(data) {
  if (!data) return '';
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function headerMap(headers) {
  const map = {};
  (headers || []).forEach(function (header) {
    if (!header || !header.name) return;
    map[header.name.toLowerCase()] = header.value || '';
  });
  return map;
}

function collectBodies(part, acc) {
  if (!part) return;
  const data = part.body && part.body.data;
  if (part.mimeType === 'text/plain' && data) acc.plain.push(decodeBase64Url(data));
  if (part.mimeType === 'text/html' && data) acc.html.push(decodeBase64Url(data));
  (part.parts || []).forEach(function (child) { collectBodies(child, acc); });
}

function textFromHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function linksFromHtml(html) {
  const links = [];
  const pattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match = pattern.exec(html);
  while (match) {
    const url = match[1];
    if (/^https?:\/\//i.test(url)) {
      links.push({ text: textFromHtml(match[2]).slice(0, 180), url: url });
    }
    match = pattern.exec(html);
  }
  return links;
}

function authFrom(header) {
  if (!header) return { available: false, spf: null, dkim: null, dmarc: null };
  function pick(name) {
    const match = header.match(new RegExp('\\b' + name + '\\s*=\\s*(pass|fail|softfail|neutral|none|temperror|permerror)', 'i'));
    return match ? match[1].toLowerCase() : null;
  }
  return { available: true, spf: pick('spf'), dkim: pick('dkim'), dmarc: pick('dmarc') };
}

function parseFrom(value) {
  const match = /^(.*)<([^>]+)>$/.exec((value || '').trim());
  if (!match) return { displayName: '', email: (value || '').trim() };
  return { displayName: match[1].replace(/"/g, '').trim(), email: match[2].trim() };
}

function parseGmailMessage(payload) {
  const headers = headerMap(payload.payload && payload.payload.headers);
  const bodies = { plain: [], html: [] };
  collectBodies(payload.payload, bodies);
  const plain = bodies.plain.join('\n').trim();
  const html = bodies.html.join('\n');
  const sender = parseFrom(headers.from || '');
  return {
    messageId: payload.id,
    threadId: payload.threadId || null,
    sender: sender,
    subject: headers.subject || '',
    date: headers.date || '',
    body: plain || textFromHtml(html),
    links: linksFromHtml(html),
    authentication: authFrom(headers['authentication-results'] || '')
  };
}

export { parseGmailMessage };
