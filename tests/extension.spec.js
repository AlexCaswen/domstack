const { test, expect, chromium } = require("@playwright/test");
const path = require("node:path");

const extensionPath = path.resolve(__dirname, "..");

async function launchExtension() {
  return chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
}

async function serveSubstackFixture(page, body) {
  await page.route("https://test.substack.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body>${body}</body></html>`,
    })
  );
  await page.goto("https://test.substack.com/post");
}

test("dismisses a recognized Substack interstitial", async () => {
  const context = await launchExtension();
  const page = await context.newPage();

  await serveSubstackFixture(
    page,
    `<div role="dialog" id="prompt">
       <h1>Pledge your support</h1>
       <button onclick="document.querySelector('#prompt').remove()">No thanks</button>
     </div>`
  );

  await expect(page.locator("#prompt")).toHaveCount(0);
  await context.close();
});

test("leaves unrelated Substack dialogs alone", async () => {
  const context = await launchExtension();
  const page = await context.newPage();

  await serveSubstackFixture(
    page,
    `<div role="dialog" id="settings">
       <h1>Account settings</h1>
       <button>Close</button>
     </div>`
  );

  await page.waitForTimeout(500);
  await expect(page.locator("#settings")).toBeVisible();
  await context.close();
});

test("uses the backdrop fallback for a recognized prompt without a button", async () => {
  const context = await launchExtension();
  const page = await context.newPage();

  await serveSubstackFixture(
    page,
    `<div role="dialog" id="prompt" style="position:fixed;inset:0"
          onclick="this.remove()">
       <h1>Get the Substack app</h1>
     </div>`
  );

  await expect(page.locator("#prompt")).toHaveCount(0);
  await context.close();
});
