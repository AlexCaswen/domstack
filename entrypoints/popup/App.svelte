<script lang="ts">
  import { onMount } from "svelte";

  let enabled = true;

  onMount(() => {
    chrome.storage.sync.get({ enabled: true }, (result) => {
      enabled = Boolean(result.enabled);
    });
  });

  function updateEnabled(): void {
    chrome.storage.sync.set({ enabled }, () => {
      chrome.tabs.query({ url: "*://*.substack.com/*" }, (tabs) => {
        for (const tab of tabs) {
          if (tab.id !== undefined) chrome.tabs.reload(tab.id);
        }
      });
    });
  }
</script>

<svelte:head>
  <title>DOMstack</title>
</svelte:head>

<div class="header">
  <img src="/icons/icon48.png" alt="DOMstack" />
  <h1>DOMstack</h1>
</div>
<p class="description">
  Auto-skips pledge prompts, share nags, and other subscribe-flow interruptions on Substack.
</p>
<div class="toggle-row">
  <span class="toggle-label">Enabled</span>
  <label class="toggle">
    <input id="toggle" type="checkbox" bind:checked={enabled} onchange={updateEnabled} />
    <span class="slider"></span>
  </label>
</div>
<p class:active={enabled} class="status" id="status">
  {enabled ? "Active on *.substack.com" : "Paused — prompts will appear normally"}
</p>

<style>
  :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  :global(body) {
    width: 260px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 16px;
    background: #fff;
    color: #1a1a1a;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .header img {
    width: 24px;
    height: 24px;
  }
  .header h1 {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.3px;
  }
  .description {
    margin-bottom: 16px;
    color: #666;
    font-size: 12px;
    line-height: 1.4;
  }
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .toggle-label {
    font-size: 13px;
    font-weight: 500;
  }
  .toggle {
    position: relative;
    width: 40px;
    height: 22px;
  }
  .toggle input {
    width: 0;
    height: 0;
    opacity: 0;
  }
  .slider {
    position: absolute;
    inset: 0;
    cursor: pointer;
    background: #ccc;
    border-radius: 22px;
    transition: background 0.2s;
  }
  .slider::before {
    position: absolute;
    bottom: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    content: "";
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  input:checked + .slider {
    background: #e85d3a;
  }
  input:checked + .slider::before {
    transform: translateX(18px);
  }
  .status {
    margin-top: 12px;
    color: #999;
    font-size: 11px;
    text-align: center;
  }
  .status.active {
    color: #e85d3a;
  }
</style>
