'use strict';

import { fetchMessage } from './gmail-api.js';
import { assess } from './heuristic-detector.js';
import { PHISHLENS_WORKER_URL } from './config.js';

let currentSelection = { status: 'none' };
let latest = null;
let requestSeq = 0;
let activeTabId = null;

function send(tabId, result) {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, { type: 'PHISHLENS_RESULT', result: result }).catch(function () {});
}

function authFields(message) {
  const auth = message.authentication || {};
  return {
    spf: auth.available && auth.spf ? auth.spf : 'Unavailable',
    dkim: auth.available && auth.dkim ? auth.dkim : 'Unavailable',
    dmarc: auth.available && auth.dmarc ? auth.dmarc : 'Unavailable'
  };
}

function localReport(message, warning, cloudOn) {
  const result = assess(message);
  return Object.assign({
    status: 'report',
    legacyMessageId: message.messageId,
    from: message.sender.email || 'Unknown sender',
    subject: message.subject || '(no subject)',
    analysisMethod: 'local_heuristic',
    cloudOn: Boolean(cloudOn),
    unreachable: Boolean(cloudOn),
    warning: warning || 'Cloudflare AI is off. This score is from the on-device heuristic, which can miss phishing and can flag legitimate mail.'
  }, authFields(message), result);
}

function cloudReport(message, payload) {
  return {
    status: 'report',
    legacyMessageId: message.messageId,
    from: message.sender.email || 'Unknown sender',
    subject: message.subject || '(no subject)',
    score: payload.score,
    riskLevel: payload.riskLevel,
    summary: payload.summary,
    findings: payload.findings || [],
    analysisMethod: payload.analysisMethod || 'workers_ai',
    cloudOn: true,
    warning: payload.analysisStatus === 'ai_unavailable' ? 'Workers AI did not return a result. The score uses the Cloudflare rules only.' : '',
    spf: payload.authenticationAssessment && payload.authenticationAssessment.spf ? payload.authenticationAssessment.spf : authFields(message).spf,
    dkim: payload.authenticationAssessment && payload.authenticationAssessment.dkim ? payload.authenticationAssessment.dkim : authFields(message).dkim,
    dmarc: payload.authenticationAssessment && payload.authenticationAssessment.dmarc ? payload.authenticationAssessment.dmarc : authFields(message).dmarc
  };
}

async function settings() {
  return chrome.storage.local.get({ consented: false, cloudAi: true });
}

async function publish(message, seq, tabId) {
  latest = message;
  const prefs = await settings();
  if (seq !== requestSeq) return;
  if (!prefs.consented) {
    send(tabId, {
      status: 'consent',
      legacyMessageId: message.messageId,
      from: message.sender.email || 'Unknown sender',
      subject: message.subject || '(no subject)'
    });
    return;
  }
  if (!prefs.cloudAi || !PHISHLENS_WORKER_URL) {
    const warning = PHISHLENS_WORKER_URL
      ? ''
      : 'The Cloudflare Worker URL is not set yet, so this is the local heuristic.';
    send(tabId, localReport(message, warning, !prefs.cloudAi ? false : true));
    return;
  }
  send(tabId, { status: 'analyzing', legacyMessageId: message.messageId });
  try {
    const response = await fetch(PHISHLENS_WORKER_URL.replace(/\/$/, '') + '/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: String(Date.now()),
        messageId: message.messageId,
        threadId: message.threadId,
        sender: message.sender,
        subject: message.subject,
        body: message.body,
        links: message.links,
        authentication: message.authentication
      })
    });
    const payload = await response.json();
    if (seq !== requestSeq) return;
    if (!response.ok) throw new Error(payload.error || 'Cloudflare analysis failed.');
    send(tabId, cloudReport(message, payload));
  } catch (error) {
    if (seq !== requestSeq) return;
    send(tabId, localReport(message, 'Cloudflare AI is still on, but ' + PHISHLENS_WORKER_URL + ' could not be reached. The new workers.dev certificate may still be propagating, so Workers AI did not see this message.', true));
  }
}

function failure(selection, error) {
  return {
    status: error && error.auth ? 'auth_error' : 'error',
    legacyMessageId: selection.legacyMessageId,
    message: error && error.message ? error.message : 'Gmail request failed.'
  };
}

async function loadSelection(selection, interactive) {
  const seq = requestSeq;
  const tabId = activeTabId;
  try {
    const message = await fetchMessage(selection.legacyMessageId, interactive);
    if (seq !== requestSeq) return;
    await publish(message, seq, tabId);
  } catch (error) {
    if (seq !== requestSeq) return;
    send(tabId, failure(selection, error));
  }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message) return;
  if (sender.tab && sender.tab.id) activeTabId = sender.tab.id;

  if (message.type === 'PHISHLENS_RECONNECT' || message.type === 'PHISHLENS_CONSENT' || message.type === 'PHISHLENS_SET_CLOUD') {
    const next = message.type === 'PHISHLENS_CONSENT'
      ? { consented: true, cloudAi: true }
      : message.type === 'PHISHLENS_SET_CLOUD'
        ? { cloudAi: Boolean(message.cloudAi) }
        : null;
    const run = function () {
      if (currentSelection.status === 'detected' && currentSelection.legacyMessageId) {
        requestSeq += 1;
        loadSelection(currentSelection, message.type === 'PHISHLENS_RECONNECT');
      } else if (latest) {
        requestSeq += 1;
        publish(latest, requestSeq, activeTabId);
      }
    };
    if (next) chrome.storage.local.set(next).then(run);
    else run();
    sendResponse({ ok: true });
    return;
  }

  if (message.type !== 'PHISHLENS_SELECTION' || !message.selection) return;
  currentSelection = message.selection;
  sendResponse({ ok: true });
  if (currentSelection.status !== 'detected' || !currentSelection.legacyMessageId) return;
  requestSeq += 1;
  loadSelection(currentSelection, true);
});
