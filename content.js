/**
 * DOMstack — auto-dismiss Substack's subscribe-flow interruptions.
 *
 * Strategy:
 *  1. This script watches the DOM for dynamically injected modals and
 *     auto-clicks dismiss/skip/no-thanks buttons by text content,
 *     which is far more resilient than class-name selectors.
 *  2. A small delay before clicking avoids race conditions where the
 *     modal's own JS hasn't finished binding handlers yet.
 */

(function () {
  "use strict";

  const CLICK_DELAY_MS = 150;
  const DEBOUNCE_MS = 100;

  // ── Dismiss-button text patterns ──────────────────────────────────
  // Lowercase, tested with includes() against the trimmed innerText of
  // <button> and <a> elements inside detected modals.
  const DISMISS_TEXTS = [
    "no thanks",
    "no, thanks",
    "maybe later",
    "not now",
    "skip",
    "continue without",
    "i'll do this later",
    "i'll pass",
    "dismiss",
    "close",
    "not right now",
    "remind me later",
  ];

  // ── Modal-content indicators ──────────────────────────────────────
  // If a modal/overlay's text includes any of these, it's a target.
  const MODAL_INDICATORS = [
    "pledge your support",
    "pledge to",
    "share on twitter",
    "share on x",
    "share this post",
    "tell your friends",
    "share with friends",
    "tweet this",
    "post to x",
    "spread the word",
    "why did you subscribe",
    "get the app",
    "get the substack app",
    "download the app",
    "download the substack app",
    "subscribe to more",
    "recommendations for you",
    "you might also like",
  ];

  // ── Utility ───────────────────────────────────────────────────────

  /** Check if DOMstack is enabled (defaults to true). */
  function isEnabled() {
    return new Promise((resolve) => {
      if (chrome?.storage?.sync) {
        chrome.storage.sync.get({ enabled: true }, (r) => resolve(r.enabled));
      } else {
        resolve(true);
      }
    });
  }

  /** Normalise text for matching. */
  function norm(s) {
    return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
  }

  /** Check rendered visibility without rejecting fixed-position elements. */
  function isVisible(el) {
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
  }

  /** Find the best dismiss button inside an element. */
  function findDismissButton(container) {
    const candidates = container.querySelectorAll(
      'button, a, [role="button"], [class*="dismiss"], [class*="close"], [class*="skip"]'
    );
    for (const el of candidates) {
      const text = norm(el.innerText || el.textContent);
      const aria = norm(el.getAttribute("aria-label") || "");
      const title = norm(el.getAttribute("title") || "");

      // Check text content
      for (const pattern of DISMISS_TEXTS) {
        if (text.includes(pattern) || aria.includes(pattern) || title.includes(pattern)) {
          return el;
        }
      }

      // Fallback: × close button (common pattern)
      if (text === "×" || text === "✕" || text === "x" || aria === "close" || title === "close") {
        return el;
      }
    }
    return null;
  }

  /** Check if an element looks like a Substack interstitial modal. */
  function isTargetModal(el) {
    const text = norm(el.innerText || el.textContent);
    return MODAL_INDICATORS.some((indicator) => text.includes(indicator));
  }

  /**
   * Detect modal containers. Substack uses a few patterns:
   *  - Pencraft overlay modules (class contains "overlay" or "modal")
   *  - Fixed/absolute positioned full-viewport divs with backdrop
   *  - Dialog elements
   */
  function findModals() {
    const selectors = [
      '[class*="modal" i]',
      '[class*="overlay" i]',
      '[class*="dialog" i]',
      '[class*="popup" i]',
      '[class*="interstitial" i]',
      '[class*="prompt" i]',
      '[role="dialog"]',
      '[role="alertdialog"]',
      "dialog[open]",
    ];

    const seen = new Set();
    const results = [];

    for (const sel of selectors) {
      try {
        for (const el of document.querySelectorAll(sel)) {
          if (!seen.has(el) && isVisible(el)) {
            seen.add(el);
            results.push(el);
          }
        }
      } catch (_) {
        // Selector may not be valid in all contexts
      }
    }

    return results;
  }

  // ── Core dismiss logic ────────────────────────────────────────────

  const dismissed = new WeakSet();

  function sweep() {
    const modals = findModals();
    for (const modal of modals) {
      if (dismissed.has(modal)) continue;
      if (!isTargetModal(modal)) continue;

      const btn = findDismissButton(modal);
      if (btn) {
        dismissed.add(modal);
        setTimeout(() => {
          if (btn.isConnected) {
            btn.click();
            console.log("[DOMstack] Dismissed:", norm(modal.innerText).slice(0, 80));
          } else {
            dismissed.delete(modal);
            debouncedSweep();
          }
        }, CLICK_DELAY_MS);
      } else {
        tryBackdropDismiss(modal);
      }
    }
  }

  // ── Backdrop click fallback ───────────────────────────────────────
  // Some Substack modals don't have a visible dismiss button — clicking
  // outside the inner card (on the backdrop) closes them.

  function tryBackdropDismiss(modal) {
    if (dismissed.has(modal)) return;

    // Look for backdrop / overlay siblings or parent
    const style = getComputedStyle(modal);
    if (
      style.position === "fixed" &&
      (style.inset === "0px" ||
        (style.top === "0px" && style.left === "0px" && style.width === "100%" && style.height === "100%"))
    ) {
      dismissed.add(modal);
      setTimeout(() => {
        if (modal.isConnected) {
          modal.click(); // click backdrop
          console.log("[DOMstack] Backdrop-dismissed modal");
        } else {
          dismissed.delete(modal);
        }
      }, CLICK_DELAY_MS);
    }
  }

  // ── Subscribe-flow specific ───────────────────────────────────────
  // After entering an email, Substack chains several screens.
  // This catches the "continue" / "skip" links that appear between them.

  function sweepSubscribeFlow() {
    // Look for standalone skip/no-thanks links outside obvious modals
    const allLinks = document.querySelectorAll("a, button");
    for (const el of allLinks) {
      if (dismissed.has(el)) continue;
      const text = norm(el.innerText || el.textContent);
      const isSmallSkip =
        (text === "no thanks" || text === "no, thanks" || text === "skip" || text === "maybe later") &&
        isVisible(el);

      if (isSmallSkip) {
        // Verify it's inside something that looks like a subscribe flow
        const parent = el.closest(
          '[class*="modal"], [class*="overlay"], [class*="dialog"], [class*="prompt"], [class*="flow"], [class*="onboarding"], [role="dialog"]'
        );
        if (parent && isTargetModal(parent)) {
          dismissed.add(el);
          setTimeout(() => {
            el.click();
            console.log("[DOMstack] Flow-skipped:", text);
          }, CLICK_DELAY_MS);
        }
      }
    }
  }

  // ── Observer ──────────────────────────────────────────────────────

  let timer = null;

  function debouncedSweep() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!(await isEnabled())) return;
      sweep();
      sweepSubscribeFlow();
    }, DEBOUNCE_MS);
  }

  async function init() {
    if (!(await isEnabled())) {
      console.log("[DOMstack] Disabled by user.");
      return;
    }

    // Initial sweep
    sweep();
    sweepSubscribeFlow();

    // Watch for dynamically added modals
    const observer = new MutationObserver((mutations) => {
      let dominated = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          dominated = true;
          break;
        }
      }
      if (dominated) debouncedSweep();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log("[DOMstack] Active — monitoring for interstitials.");
  }

  // ── Boot ──────────────────────────────────────────────────────────

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
