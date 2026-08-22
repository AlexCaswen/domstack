# DOMstack

**Auto-skip Substack's subscribe-flow interruptions.**

When you subscribe to a Substack newsletter, the platform chains together a series of
interstitial prompts — pledge your support, share on Twitter/X, tell your friends, get the app,
and more. DOMstack automatically dismisses these so you can subscribe and get straight to reading.

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

DOMstack uses a `MutationObserver` to watch for dynamically injected modals and matches
dismiss buttons by their visible text content (e.g. "No thanks", "Skip", "Maybe later")
rather than CSS class names. This makes it resilient to Substack's frequent frontend updates.

The script only acts after both a modal-like container and recognized prompt text are
present. This avoids hiding unrelated Substack dialogs and keeps the on/off switch reliable.

## Installation

### From source (developer mode)

1. Clone or download this folder
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `domstack` folder
5. Done — the extension is active on all `*.substack.com` pages

### From Chrome Web Store

*(link here when published)*

## Permissions

- **`storage`** — saves your enabled/disabled preference
- **Host: `*.substack.com`** — content script runs only on Substack domains

No data is collected, transmitted, or stored beyond your local on/off preference.

## Privacy

DOMstack runs entirely locally. It does not:

- Collect or transmit any data
- Track your browsing or subscriptions
- Communicate with any external server
- Require an account or sign-in

## License

MIT
