const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const puppeteer = require("puppeteer");

const extensionPath = path.resolve(__dirname, "..", ".output", "chrome-mv3");
let browser;

before(async () => {
  browser = await puppeteer.launch({
    headless: true,
    enableExtensions: [extensionPath],
    args: process.env.CI ? ["--no-sandbox"] : [],
  });
});

after(async () => {
  await browser?.close();
});

async function serveSubstackFixture(page, body, pathname = "/post") {
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
  await page.goto(`https://test.substack.com${pathname}`, { waitUntil: "domcontentloaded" });
}

test("generated manifest preserves the extension contract", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, "manifest.json"), "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "DOMstack");
  assert.equal(manifest.version, "1.0.3");
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(manifest.host_permissions, ["*://*.substack.com/*"]);
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.deepEqual(manifest.icons, {
    16: "icons/icon16.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  });
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual(manifest.content_scripts[0].matches, ["*://*.substack.com/*"]);
  assert.equal(manifest.content_scripts[0].run_at, "document_idle");
});

test("dismisses a recognized Substack interstitial", async () => {
  const page = await browser.newPage();
  try {
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
    await page.close();
  }
});

test("leaves unrelated Substack dialogs alone", async () => {
  const page = await browser.newPage();
  try {
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
    await page.close();
  }
});

test("uses the backdrop fallback for a recognized prompt without a button", async () => {
  const page = await browser.newPage();
  try {
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
    await page.close();
  }
});

for (const [name, heading, dismissText] of [
  ["recommendation selection", "Get QC's recommendations", "Skip"],
  ["publication recommendation", "Do you want to recommend Thicket Forte?", "Skip for now"],
  ["subscription sharing", "Spread the word", "Maybe later"],
]) {
  test(`skips the full-page ${name} subscribe step`, async () => {
    const page = await browser.newPage();
    try {
      await serveSubstackFixture(
        page,
        `<main id="step">
           <h1>${heading}</h1>
           <button onclick="document.querySelector('#step').remove()">${dismissText}</button>
         </main>`,
        "/subscribe?utm_source=test"
      );

      await page.waitForFunction(() => !document.querySelector("#step"));
      assert.equal(await page.$("#step"), null);
    } finally {
      await page.close();
    }
  });
}

test("does not click a page-level skip outside the subscribe flow", async () => {
  const page = await browser.newPage();
  try {
    await serveSubstackFixture(
      page,
      `<main id="article">
         <h1>Spread the word</h1>
         <button onclick="document.querySelector('#article').remove()">Maybe later</button>
       </main>`
    );

    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.notEqual(await page.$("#article"), null);
  } finally {
    await page.close();
  }
});

test("popup loads, persists its toggle, and reloads matching tabs", async () => {
  const popupBrowser = await puppeteer.launch({
    headless: true,
    args: process.env.CI ? ["--no-sandbox"] : [],
  });
  const server = http.createServer((request, response) => {
    const parsedUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const requestPath = parsedUrl.pathname === "/" ? "/popup.html" : parsedUrl.pathname;
    const rootPath = path.resolve(extensionPath);
    const filePath = path.resolve(rootPath, `.${requestPath}`);
    if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${path.sep}`)) {
      response.writeHead(403);
      response.end();
      return;
    }
    const contentType = filePath.endsWith(".js")
      ? "text/javascript"
      : filePath.endsWith(".css")
        ? "text/css"
        : filePath.endsWith(".png")
          ? "image/png"
          : "text/html";
    if (!fs.existsSync(filePath)) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": contentType });
    response.end(fs.readFileSync(filePath));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const page = await popupBrowser.newPage();
  try {
    await page.evaluateOnNewDocument(() => {
      window.__domstackTest = { enabled: false, reloads: [] };
      window.chrome = {
        storage: {
          sync: {
            get(defaults, callback) {
              callback({ enabled: window.__domstackTest.enabled ?? defaults.enabled });
            },
            set(values, callback) {
              window.__domstackTest.enabled = values.enabled;
              callback();
            },
          },
        },
        tabs: {
          query(_query, callback) {
            callback([{ id: 42 }]);
          },
          reload(id) {
            window.__domstackTest.reloads.push(id);
          },
        },
      };
    });

    const address = server.address();
    await page.goto(`http://127.0.0.1:${address.port}/popup.html`, {
      waitUntil: "networkidle0",
    });
    await page.waitForFunction(() =>
      document.querySelector("#status")?.textContent.includes("Paused")
    );
    await page.click("label.toggle");
    await page.waitForFunction(() =>
      document.querySelector("#status")?.textContent.includes("Active")
    );

    const state = await page.evaluate(() => window.__domstackTest);
    assert.deepEqual(state, { enabled: true, reloads: [42] });
  } finally {
    await page.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await popupBrowser.close();
  }
});
