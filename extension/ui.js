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
    '.pill.warn{background:rgba(230,179,90,.16);color:#f0d7a4}',
    '.copy{margin:10px 0 0;color:#d5deea;font-size:13px;line-height:1.45}',
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
    } else {
      panel.append(element(doc, 'div', 'pill', 'Message selected'));
      panel.append(element(doc, 'p', 'copy', 'This message is selected. Risk analysis is not connected yet.'));
      const meta = element(doc, 'dl', 'meta');
      field(doc, meta, 'Message id', selection.legacyMessageId);
      field(doc, meta, 'Thread id', selection.threadId);
      panel.append(meta);
    }

    shadow.append(panel);
  }

  function clear(doc) {
    const host = hostFor(doc);
    if (host) host.remove();
  }

  globalThis.PhishLensPanel = { render, clear };
})();
