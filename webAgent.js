import { chromium } from "playwright";
import prompts from "prompts";
import { Agent, run, tool } from "@openai/agents";
import dotenv from "dotenv";
import { z } from "zod";
import fs from "fs";
dotenv.config();

let stepCounter = 1;
fs.mkdirSync("screenshots", { recursive: true });

async function takeStepScreenshot(page, stepName) {
  const number = String(stepCounter).padStart(2, "0");
  const safeName = stepName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filePath = `screenshots/${number}_${safeName}.png`;
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`📸 Screenshot saved: ${filePath}`);
  stepCounter++;
}

function toCamel(s) {
  const t = s.replace(/\s+([a-zA-Z])/g, (_, c) => c.toUpperCase()).replace(/\s/g, "");
  return t.charAt(0).toLowerCase() + t.slice(1);
}

async function main() {
  const { url } = await prompts({
    type: "text",
    name: "url",
    message: "Enter the URL to automate:",
    initial: "https://ui.chaicode.com/auth/signup",
  });
  if (!url) return console.log(" No URL provided. Exiting...");

  const userDetails = await prompts([
    { type: "text", name: "firstName", message: "Enter your first name:" },
    { type: "text", name: "lastName", message: "Enter your last name:" },
    { type: "text", name: "email", message: "Enter your email:" },
    { type: "password", name: "password", message: "Enter your password:" },
    { type: "password", name: "confirmPassword", message: "Confirm your password:" },
  ]);

  const chromePath =
    process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    headless: false,
    executablePath: chromePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  console.log("📸 Page loaded");
  await takeStepScreenshot(page, "page_loaded");

  function getLocator(sel) {
    if (sel.startsWith("label=")) return page.getByLabel(new RegExp(sel.replace("label=", ""), "i"));
    if (sel.startsWith("text=")) return page.getByText(new RegExp(sel.replace("text=", ""), "i"));
    return page.locator(sel);
  }

  async function performType(selector, value) {
    try {
      const loc = getLocator(selector).first();
      await loc.waitFor({ state: "visible", timeout: 20000 });
      await loc.scrollIntoViewIfNeeded();
      await loc.fill(""); 
      await loc.type(value, { delay: 80 });
      console.log(`✅ Typed into ${selector}`);
      await takeStepScreenshot(page, `typed_${selector}`);
      return true;
    } catch {
      return false; 
    }
  }

  async function fillField(fieldName, value) {
    const tries = [
      `label=${fieldName}`,
      `input[name='${toCamel(fieldName)}']`,
      `input[placeholder='${fieldName}']`,
      `input[aria-label='${fieldName}']`,
    ];
    for (const sel of tries) {
      const ok = await performType(sel, value);
      if (ok) return true;
    }
    try {
      const loc = page.getByPlaceholder(new RegExp(fieldName, "i")).first();
      await loc.waitFor({ state: "visible", timeout: 5000 });
      await loc.type(value, { delay: 80 });
      console.log(`✅ Filled ${fieldName} (fuzzy match)`);
      await takeStepScreenshot(page, `fuzzy_${fieldName}`);
      return true;
    } catch {
      return false;
    }
  }

  async function performClick(buttonText) {
    const tries = [
      page.getByRole("button", { name: new RegExp(buttonText, "i") }),
      page.getByText(new RegExp(buttonText, "i")),
      page.locator(`button:has-text("${buttonText}")`),
      page.locator(`button[type='submit']`),
      page.locator(`input[type='submit']`),
    ];
    for (const loc of tries) {
      try {
        await loc.first().waitFor({ state: "visible", timeout: 5000 });
        await loc.first().scrollIntoViewIfNeeded();
        await loc.first().click();
        console.log(`✅ Clicked ${buttonText}`);
        await takeStepScreenshot(page, `clicked_${buttonText}`);
        return true;
      } catch {}
    }
    return false;
  }

  // ---- Tools for Agent ----
  const clickTool = tool({
    name: "click",
    description: "Click an element",
    parameters: z.object({ selector: z.string() }),
    async execute({ selector }) {
      return (await performClick(selector)) ? `✅ Clicked ${selector}` : `❌ Failed click ${selector}`;
    },
  });

  const typeTool = tool({
    name: "type",
    description: "Type into a field using its label text only",
    parameters: z.object({
      selector: z.string(),
      value: z.string(),
    }),
    async execute({ selector, value }) {
      try {
        let loc = page.getByLabel(selector, { exact: false }).first();
        await loc.fill(value);
        await takeStepScreenshot(page, `agent_filled_${selector}`);
        return `✅ Filled ${selector}`;
      } catch {
        return `Could not fill ${selector}`;
      }
    },
  });

  const stopTool = tool({
    name: "stop",
    description: "Stop automation",
    parameters: z.object({}),
    async execute() {
      console.log("Stopping automation.");
      await browser.close();
      process.exit(0);
    },
  });

  const automationAgent = new Agent({
    name: "WebAutomationAgent",
    instructions: `
      Fill the signup form and click submit. Use provided details:
      - First Name: ${userDetails.firstName}
      - Last Name: ${userDetails.lastName}
      - Email: ${userDetails.email}
      - Password: ${userDetails.password}
      - Confirm Password: ${userDetails.confirmPassword}
      Then click "Create Account". 
    `,
    tools: [clickTool, typeTool, stopTool],
    model: "gpt-4.1-mini",
  });

  const mapping = [
    { field: "First Name", value: userDetails.firstName },
    { field: "Last Name", value: userDetails.lastName },
    { field: "Email", value: userDetails.email },
    { field: "Password", value: userDetails.password },
    { field: "Confirm Password", value: userDetails.confirmPassword },
  ];

  for (let i = 0; i < mapping.length; i++) {
    await fillField(mapping[i].field, mapping[i].value);
  }

  await performClick("Create Account");

  console.log("✅ Done. Form submitted.");
  await takeStepScreenshot(page, "form_submitted");

  await browser.close();
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
