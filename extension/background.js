'use strict';

// Remembers which message the content script selected.
// Gmail API retrieval and Cloudflare analysis are later issues.
// This worker must not receive or store email content.

let currentSelection = { status: 'none' };

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (!message || message.type !== 'PHISHLENS_SELECTION' || !message.selection) {
    return;
  }
  currentSelection = {
    status: message.selection.status || 'none',
    legacyMessageId: message.selection.legacyMessageId || null,
    messageDomId: message.selection.messageDomId || null,
    threadId: message.selection.threadId || null
  };
  sendResponse({ ok: true, phase: 'detection' });
});
