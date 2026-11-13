'use strict';

// Watches Gmail for which message is open. Does not read message content
// and does not call Cloudflare.

(function () {
  const DEBOUNCE_MS = 250;
  let timer = null;
  let lastKey = null;
  let dismissedKey = null;
  let activeId = null;

  function panelOptions(key) {
    return {
      onClose: function () {
        dismissedKey = key;
        PhishLensPanel.clear(document);
      },
      onReconnect: function () {
        chrome.runtime.sendMessage({ type: 'PHISHLENS_RECONNECT' }).catch(function () {});
        PhishLensPanel.render(document, { status: 'loading', legacyMessageId: activeId }, panelOptions(key));
      },
      onConsent: function () {
        chrome.runtime.sendMessage({ type: 'PHISHLENS_CONSENT' }).catch(function () {});
        PhishLensPanel.render(document, { status: 'analyzing', legacyMessageId: activeId }, panelOptions(key));
      },
      onToggleCloud: function (enabled) {
        chrome.runtime.sendMessage({ type: 'PHISHLENS_SET_CLOUD', cloudAi: enabled }).catch(function () {});
        PhishLensPanel.render(document, { status: 'analyzing', legacyMessageId: activeId }, panelOptions(key));
      },
      onRetry: function () {
        chrome.runtime.sendMessage({ type: 'PHISHLENS_SET_CLOUD', cloudAi: true }).catch(function () {});
        PhishLensPanel.render(document, { status: 'analyzing', legacyMessageId: activeId }, panelOptions(key));
      }
    };
  }

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
    activeId = selection.status === 'detected' ? selection.legacyMessageId : null;
    const view = selection.status === 'detected'
      ? { status: 'loading', legacyMessageId: selection.legacyMessageId, threadId: selection.threadId }
      : selection;
    PhishLensPanel.render(document, view, panelOptions(key));
    notify(selection);
  }

  chrome.runtime.onMessage.addListener(function (message) {
    if (!message || message.type !== 'PHISHLENS_RESULT' || !message.result) return;
    if (!activeId || message.result.legacyMessageId !== activeId) return;
    const key = 'detected:' + activeId;
    if (dismissedKey === key) return;
    PhishLensPanel.render(document, message.result, panelOptions(key));
  });

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
