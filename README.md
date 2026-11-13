# PhishLens

Know the risk before you click.

PhishLens is a Chrome extension that will analyze the Gmail message you have open. This branch currently detects that message and shows a panel. It does not read the subject, sender, body, or links, and it does not send anything to Cloudflare yet.

## Install the extension

1. Open `chrome://extensions`.
2. Turn on Developer Mode.
3. Choose Load Unpacked.
4. Select the `extension` directory in this repo.
5. Open Gmail and open one message. The PhishLens panel appears at the bottom left.
6. Open a different message. The panel updates to that message id.
7. Expand more than one message in a thread. The panel asks you to leave only one open.

The extension id is pinned with the public key in `extension/manifest.json`, so it stays stable across reloads:

`lcfopfbcjkdkoaamdokiklgljmoanpib`

That id will be used later for Gmail OAuth.
