import { parseGmailMessage } from './email-parser.js';

// Gmail API access. Tokens stay in this extension and are never sent to Cloudflare.

function token(interactive) {
  return new Promise(function (resolve, reject) {
    chrome.identity.getAuthToken({ interactive: interactive }, function (value) {
      const error = chrome.runtime.lastError;
      if (error || !value) {
        const denied = new Error(error && error.message ? error.message : 'Gmail permission was not granted.');
        denied.auth = true;
        reject(denied);
        return;
      }
      resolve(value);
    });
  });
}

function dropToken(value) {
  return new Promise(function (resolve) {
    chrome.identity.removeCachedAuthToken({ token: value }, function () { resolve(); });
  });
}

async function gmailGet(path, interactive) {
  let auth = await token(interactive);
  let response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + path, {
    headers: { Authorization: 'Bearer ' + auth }
  });
  if (response.status === 401) {
    await dropToken(auth);
    auth = await token(true);
    response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + path, {
      headers: { Authorization: 'Bearer ' + auth }
    });
  }
  if (response.status === 401 || response.status === 403) {
    const error = new Error('Gmail permission was denied. Use Reconnect and choose Allow.');
    error.auth = true;
    throw error;
  }
  if (!response.ok) {
    throw new Error('Gmail could not load this message (' + response.status + ').');
  }
  return response.json();
}

async function fetchMessage(messageId, interactive) {
  const payload = await gmailGet('messages/' + encodeURIComponent(messageId) + '?format=full', interactive);
  return parseGmailMessage(payload);
}

export { fetchMessage };
