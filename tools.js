import { chromium } from 'playwright';

let browser, page;

export async function openBrowser({ url }) {
  browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  page = await context.newPage();
  await page.goto(url);
  return `Opened browser at ${url}`;
}

export async function takeScreenshot() {
  if (!page) return "No page open";
  const path = `screenshot-${Date.now()}.png`;
  await page.screenshot({ path });
  return `Screenshot saved: ${path}`;
}

export async function scrollPage({ direction = "down" }) {
  if (!page) return "No page open";
  await page.evaluate((dir) => {
    window.scrollBy(0, dir === "down" ? 300 : -300);
  }, direction);
  return `Scrolled ${direction}`;
}

export async function clickOnScreen({ selector }) {
  if (!page) return "No page open";
  await page.click(selector);
  return `Clicked on ${selector}`;
}

export async function fillForm({ selector, value }) {
  if (!page) return "No page open";
  await page.fill(selector, value);
  return `Filled ${selector} with "${value}"`;
}

export async function submitForm({ selector }) {
  if (!page) return "No page open";
  await page.click(selector);
  return `Submitted form via ${selector}`;
}

export async function closeBrowser() {
  if (browser) await browser.close();
  return "Browser closed";
}
