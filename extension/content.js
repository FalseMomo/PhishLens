'use strict';

// Watches Gmail for which message is open. Does not read message content
// and does not call Cloudflare.

(function () {
  const DEBOUNCE_MS = 250;
  let timer = null;
  let lastKey = null;
  let dismissedKey = null;

  function selectionKey(selection) {
    if (!selection || selection.status === 'none') return 'none';
    if (selection.status === 'ambiguous') {
      return 'ambiguous:' + selection.messageCount + ':' + selection.expandedCount;
    }
    return 'detected:' + selection.legacyMessageId;
  }

  function notify(selection) {
    if (!globalThis.chrome || !chrome.runtime || !chrome.runtime.id) return;
    chrome.runtime.sendMessage({ type: 'PHISHLENS_SELECTION', selection }).catch(function () {
      // The service worker is asleep or the extension was reloaded.
    });
  }

  function apply(selection) {
    const key = selectionKey(selection);
    if (key === 'none') {
      dismissedKey = null;
      if (lastKey === 'none') return;
      lastKey = 'none';
      PhishLensPanel.clear(document);
      notify(selection);
      return;
    }
    if (key === dismissedKey) {
      if (lastKey !== key) {
        lastKey = key;
        PhishLensPanel.clear(document);
      }
      return;
    }
    if (key === lastKey) return;
    lastKey = key;
    PhishLensPanel.render(document, selection, {
      onClose: function () {
        dismissedKey = key;
        PhishLensPanel.clear(document);
      }
    });
    notify(selection);
  }

  function scan() {
    apply(PhishLensSelection.findSelection(document));
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(scan, DEBOUNCE_MS);
  }

  function watch() {
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-legacy-message-id', 'data-legacy-thread-id']
    });
    window.addEventListener('hashchange', schedule);
    window.addEventListener('popstate', schedule);
    scan();
  }

  watch();
})();
