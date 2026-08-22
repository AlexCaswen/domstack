const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const puppeteer = require("puppeteer");

const extensionPath = path.resolve(__dirname, "..");

async function launchExtension() {
  return puppeteer.launch({
    headless: true,
    enableExtensions: [extensionPath],
    args: process.env.CI ? ["--no-sandbox"] : [],
  });
}

async function serveSubstackFixture(page, body) {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.url().startsWith("https://test.substack.com/")) {
      request.respond({
        contentType: "text/html",
        body: `<!doctype html><html><body>${body}</body></html>`,
      });
      return;
    }

    request.continue();
  });
  await page.goto("https://test.substack.com/post", { waitUntil: "domcontentloaded" });
}

test("dismisses a recognized Substack interstitial", async () => {
  const browser = await launchExtension();
  try {
    const page = await browser.newPage();
    await serveSubstackFixture(
      page,
      `<div role="dialog" id="prompt">
         <h1>Pledge your support</h1>
         <button onclick="document.querySelector('#prompt').remove()">No thanks</button>
       </div>`
    );

    await page.waitForFunction(() => !document.querySelector("#prompt"));
    assert.equal(await page.$("#prompt"), null);
  } finally {
    await browser.close();
  }
});

test("leaves unrelated Substack dialogs alone", async () => {
  const browser = await launchExtension();
  try {
    const page = await browser.newPage();
    await serveSubstackFixture(
      page,
      `<div role="dialog" id="settings">
         <h1>Account settings</h1>
         <button>Close</button>
       </div>`
    );

    await new Promise((resolve) => setTimeout(resolve, 500));
    const visible = await page.$eval("#settings", (element) => {
      const style = getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getClientRects().length > 0
      );
    });
    assert.equal(visible, true);
  } finally {
    await browser.close();
  }
});

test("uses the backdrop fallback for a recognized prompt without a button", async () => {
  const browser = await launchExtension();
  try {
    const page = await browser.newPage();
    await serveSubstackFixture(
      page,
      `<div role="dialog" id="prompt" style="position:fixed;inset:0"
            onclick="this.remove()">
         <h1>Get the Substack app</h1>
       </div>`
    );

    await page.waitForFunction(() => !document.querySelector("#prompt"));
    assert.equal(await page.$("#prompt"), null);
  } finally {
    await browser.close();
  }
});
