# DOMstack

**Auto-skip Substack's subscribe-flow interruptions.**

On Substack, after you subscribe to a newsletter, the website chains together a series of
interstitial prompts that cannot be turned off in settings. This Chrome extension automatically
dismisses, blocks, and skips those annoying intrusions, allowing you to get back to reading your
favourite authors.

## What it skips

- **Pledge prompts** — "Pledge your support" modals with pre-filled dollar amounts
- **Share/tweet nags** — "Share on X", "Tell your friends", "Spread the word"
- **App download prompts** — "Get the Substack app"
- **Post-subscribe surveys** — "Why did you subscribe?"
- **Recommendation walls** — "You might also like" interstitials after subscribing

## What it doesn't touch

- Normal Substack UI (reading, writing, commenting, Notes)
- Paywall prompts on paid posts (those are legitimate access controls)
- Your actual subscription — DOMstack only skips the nagging, not the subscribe action itself

## How it works

DOMstack uses a `MutationObserver` to watch for dynamically injected modals and matches dismiss
buttons by their visible text content (e.g. "No thanks", "Skip", "Maybe later") rather than CSS
class names. This makes it resilient to Substack's frequent frontend updates.

The script only acts after both a modal-like container and recognized prompt text are present. This
avoids hiding unrelated Substack dialogs and keeps the on/off switch reliable.

## Installation

### From source (developer mode)

1. Clone or download this folder
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `domstack` folder
5. Done — the extension is active on all `*.substack.com` pages

### From Chrome Web Store

_(link here when published)_

## Permissions

- **`storage`** — saves your enabled/disabled preference
- **Host: `*.substack.com`** — content script runs only on Substack domains

No data is collected, transmitted, or stored beyond your local on/off preference.

## Testing

Run the browser integration tests locally with:

```bash
npm ci --ignore-scripts
npx puppeteer browsers install chrome
npm test
```

The project follows the Node.js 24 LTS major channel. Puppeteer drives Chrome while Node's built-in
test runner executes the integration suite. Dependency lifecycle scripts are disabled during CI
installation; Chrome is downloaded explicitly afterward.

Format the project with `npm run format`. GitHub Actions and tagged Cloud Builds both run
`npm run verify`, which rejects formatting drift before running the browser tests.

The tagged Google Cloud Build runs the same Puppeteer tests against Chrome. The extension ZIP is
created and uploaded to the Chrome Web Store only after all tests pass. The build waits for
asynchronous package validation, then submits the revision for review. After Chrome Web Store
approval, the revision is published automatically. Store validation warnings are treated as release
failures.

The service account used by the build must be added under **Account** in the Chrome Web Store
Developer Dashboard. The Chrome Web Store API must also be enabled in the build's Google Cloud
project.

The public publisher UUID is stored as two Cloud Build substitution fragments because a complete
UUID is incorrectly classified as an OpenVSX access token by GitHub secret scanning.

## Privacy

DOMstack runs entirely locally. It does not:

- Collect or transmit any data
- Track your browsing or subscriptions
- Communicate with any external server
- Require an account or sign-in

See the full [Privacy Policy](PRIVACY.md).

## Development disclosure

This repository was built with assistance from Claude Opus 4.6 and ChatGPT 5.6 Sol.

## License

MIT
