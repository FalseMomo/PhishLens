'use strict';

// Draws the PhishLens panel. Email content is never written into the page.

(function () {
  const HOST_ID = 'phishlens-root';
  const PANEL_CSS = [
    ':host{all:initial}',
    '.panel{box-sizing:border-box;width:320px;padding:14px 14px 12px;border:1px solid rgba(232,238,247,.14);border-radius:14px;background:#0e1c2f;color:#e7eef7;font-family:Segoe UI,system-ui,sans-serif;box-shadow:0 16px 40px rgba(4,10,20,.35)}',
    '.header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}',
    '.title-wrap{display:flex;align-items:center;gap:10px;min-width:0}',
    '.mark{flex:0 0 auto;width:28px;height:28px;border-radius:8px;background:#17304d;color:#c5d8ff;font-size:11px;font-weight:700;letter-spacing:.04em;line-height:28px;text-align:center}',
    '.name{font-size:15px;font-weight:600}',
    '.tagline{margin-top:2px;color:#93a4b8;font-size:12px}',
    '.close{margin:0;padding:4px 8px;border:1px solid rgba(232,238,247,.16);border-radius:999px;background:transparent;color:#c5d2e2;font:inherit;font-size:12px;cursor:pointer}',
    '.pill{display:inline-block;margin-top:12px;padding:3px 8px;border-radius:999px;background:rgba(142,183,255,.14);color:#c5d8ff;font-size:12px;font-weight:600}',
    '.pill.warn,.pill.suspicious{background:rgba(230,179,90,.16);color:#f0d7a4}',
    '.pill.high{background:rgba(225,91,100,.18);color:#ffc1c6}',
    '.pill.low{background:rgba(61,190,122,.16);color:#b7ebc8}',
    '.bar{height:8px;margin-top:10px;border-radius:999px;background:rgba(232,238,247,.12);overflow:hidden}',
    '.bar span{display:block;height:100%;background:#8eb7ff}',
    '.bar.high span{background:#e15b64}',
    '.bar.suspicious span{background:#e6b35a}',
    '.bar.low span{background:#3dbe7a}',
    '.finding{margin:8px 0 0;color:#d5deea;font-size:13px;line-height:1.4}',
    '.details{margin-top:8px}',
    '.warning{margin-top:8px;color:#f0d7a4;font-size:12px;line-height:1.4}',
    '.copy{margin:10px 0 0;color:#d5deea;font-size:13px;line-height:1.45}',
    '.action{display:inline-block;margin-top:12px;padding:6px 10px;border:0;border-radius:999px;background:#8eb7ff;color:#0e1c2f;font:inherit;font-size:12px;font-weight:700;cursor:pointer}',
    '.meta{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;margin:12px 0 0}',
    '.meta dt{color:#93a4b8;font-size:11px}',
    '.meta dd{margin:0;overflow-wrap:anywhere;color:#e7eef7;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}'
  ].join('');
  let cssText = PANEL_CSS;

  function hostFor(doc) {
    return doc.getElementById(HOST_ID);
  }

  function element(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function ensure(doc) {
    let host = hostFor(doc);
    if (host && host.shadowRoot) return host.shadowRoot;

    host = doc.createElement('div');
    host.id = HOST_ID;
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('bottom', '20px', 'important');
    host.style.setProperty('left', '20px', 'important');
    host.style.setProperty('width', '320px', 'important');
    host.style.setProperty('z-index', '2147483000', 'important');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = cssText;
    shadow.append(style);
    doc.documentElement.append(host);
    return shadow;
  }

  function field(doc, list, label, value) {
    if (!value) return;
    list.append(element(doc, 'dt', null, label));
    list.append(element(doc, 'dd', null, value));
  }

  function render(doc, selection, options) {
    cssText = options && options.cssText ? options.cssText : cssText;
    const shadow = ensure(doc);
    const previous = shadow.querySelector('.panel');
    if (previous) previous.remove();

    const panel = element(doc, 'section', 'panel');
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'PhishLens');

    const header = element(doc, 'div', 'header');
    const titleWrap = element(doc, 'div', 'title-wrap');
    titleWrap.append(element(doc, 'div', 'mark', 'PL'));
    const titles = element(doc, 'div', 'titles');
    titles.append(element(doc, 'div', 'name', 'PhishLens'));
    titles.append(element(doc, 'div', 'tagline', 'Know the risk before you click.'));
    titleWrap.append(titles);

    const close = element(doc, 'button', 'close', 'Close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close PhishLens');
    close.addEventListener('click', function () {
      if (options && options.onClose) options.onClose();
    });

    header.append(titleWrap, close);
    panel.append(header);

    if (selection.status === 'ambiguous') {
      panel.append(element(doc, 'div', 'pill warn', 'Message unclear'));
      panel.append(element(doc, 'p', 'copy', 'Several messages are expanded. Collapse the thread so only one is open. PhishLens will not guess.'));
    } else if (selection.status === 'auth_error') {
      panel.append(element(doc, 'div', 'pill warn', 'Gmail needs permission'));
      panel.append(element(doc, 'p', 'copy', selection.message || 'Allow Gmail access to read this message.'));
      const reconnect = element(doc, 'button', 'action', 'Reconnect');
      reconnect.type = 'button';
      reconnect.addEventListener('click', function () {
        if (options && options.onReconnect) options.onReconnect();
      });
      panel.append(reconnect);
    } else if (selection.status === 'error') {
      panel.append(element(doc, 'div', 'pill warn', 'Could not read message'));
      panel.append(element(doc, 'p', 'copy', selection.message || 'Gmail request failed.'));
    } else if (selection.status === 'consent') {
      panel.append(element(doc, 'div', 'pill', 'Before the first scan'));
      panel.append(element(doc, 'p', 'copy', 'PhishLens will send the sender, subject, message text, links, and authentication results to Cloudflare for Workers AI. Gmail access tokens stay on this device.'));
      const allow = element(doc, 'button', 'action', 'Continue with Cloudflare AI');
      allow.type = 'button';
      allow.addEventListener('click', function () {
        if (options && options.onConsent) options.onConsent();
      });
      panel.append(allow);
    } else if (selection.status === 'analyzing') {
      panel.append(element(doc, 'div', 'pill', 'Analyzing'));
      panel.append(element(doc, 'p', 'copy', 'Cloudflare is scoring this message.'));
    } else if (selection.status === 'report') {
      const level = selection.riskLevel || 'low';
      const label = level === 'high' ? 'High risk' : level === 'suspicious' ? 'Suspicious' : 'Low detected risk';
      panel.append(element(doc, 'div', 'pill ' + level, label + ' ' + selection.score + '/100'));
      const bar = element(doc, 'div', 'bar ' + level);
      const fill = element(doc, 'span');
      fill.style.width = Math.max(0, Math.min(100, Number(selection.score) || 0)) + '%';
      bar.append(fill);
      panel.append(bar);
      panel.append(element(doc, 'p', 'copy', selection.summary || ''));
      (selection.findings || []).slice(0, 3).forEach(function (item) {
        panel.append(element(doc, 'p', 'finding', item.title));
      });
      const more = element(doc, 'button', 'action', 'Read more');
      more.type = 'button';
      const details = element(doc, 'div', 'details');
      details.hidden = true;
      if (selection.warning) details.append(element(doc, 'p', 'warning', selection.warning));
      if (!(selection.findings || []).length) {
        details.append(element(doc, 'p', 'finding', 'The score is 0 because no rule matched. The check looked for a suspicious or misleading link, a credential or payment request, and a failed SPF, DKIM, or DMARC result. None of those were present. Urgency alone cannot raise the score. This is not a guarantee the message is safe.'));
      }
      const meta = element(doc, 'dl', 'meta');
      field(doc, meta, 'From', selection.from);
      field(doc, meta, 'Subject', selection.subject);
      field(doc, meta, 'SPF', selection.spf);
      field(doc, meta, 'DKIM', selection.dkim);
      field(doc, meta, 'DMARC', selection.dmarc);
      field(doc, meta, 'Source', selection.analysisMethod === 'workers_ai' ? 'Cloudflare Workers AI' : selection.analysisMethod === 'rules_ai_unavailable' ? 'Cloudflare rules' : 'Local heuristic');
      details.append(meta);
      (selection.findings || []).forEach(function (item) {
        const line = element(doc, 'p', 'finding', item.title);
        if (item.explanation) line.textContent = item.title + '. ' + item.explanation;
        if (item.evidence) line.textContent += ' Evidence: ' + item.evidence;
        details.append(line);
      });
      more.addEventListener('click', function () {
        details.hidden = !details.hidden;
        more.textContent = details.hidden ? 'Read more' : 'Show less';
      });
      const toggleLabel = selection.unreachable ? 'Retry Cloudflare' : selection.cloudOn ? 'Turn AI off' : 'Turn AI on';
      const toggle = element(doc, 'button', 'close', toggleLabel);
      toggle.type = 'button';
      toggle.addEventListener('click', function () {
        if (selection.unreachable && options && options.onRetry) options.onRetry();
        else if (options && options.onToggleCloud) options.onToggleCloud(!selection.cloudOn);
      });
      panel.append(more, details, toggle);
    } else if (selection.status === 'ready') {
      panel.append(element(doc, 'div', 'pill', 'Read from Gmail'));
      panel.append(element(doc, 'p', 'copy', selection.subject || '(no subject)'));
    } else {
      panel.append(element(doc, 'div', 'pill', 'Reading Gmail'));
      panel.append(element(doc, 'p', 'copy', 'Loading this message from the Gmail API.'));
    }

    shadow.append(panel);
  }

  function clear(doc) {
    const host = hostFor(doc);
    if (host) host.remove();
  }

  globalThis.PhishLensPanel = { render, clear };
})();
