/* Copyright 2026 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { closePages, loadAndWait } from "./test_utils.mjs";

async function openKeyboardShortcuts(page) {
  await page.click("#secondaryToolbarToggleButton");
  await page.waitForSelector("#secondaryToolbar", { hidden: false });
  await page.click("#keyboardShortcuts");
  await page.waitForSelector("#keyboardShortcutsDialog", { hidden: false });
}

describe("Configurable keyboard shortcuts", () => {
  describe("Settings dialog", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".textLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must open the shortcuts dialog from the secondary toolbar", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await openKeyboardShortcuts(page);
          const rows = await page.$$("#keyboardShortcutsList .shortcutsRow");
          expect(rows.length)
            .withContext(`In ${browserName}`)
            .toBeGreaterThan(3);
        })
      );
    });

    it("must reject colliding shortcut assignments", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await openKeyboardShortcuts(page);

          await page.click(
            '.shortcutsRow[data-action-id="underline"] .shortcutsBinding'
          );
          await page.waitForSelector(
            '.shortcutsRow[data-action-id="underline"] .shortcutsBinding.capturing'
          );

          // Dispatch on the dialog so the capture listener sees the key.
          await page.evaluate(() => {
            const dialog = document.getElementById("keyboardShortcutsDialog");
            dialog.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "h",
                code: "KeyH",
                bubbles: true,
                cancelable: true,
              })
            );
          });

          await page.waitForFunction(() => {
            const status = document.getElementById("keyboardShortcutsStatus");
            return status && !status.hidden && status.textContent.trim() !== "";
          });

          const statusText = await page.$eval(
            "#keyboardShortcutsStatus",
            el => el.textContent
          );
          expect(statusText.length)
            .withContext(`In ${browserName}`)
            .toBeGreaterThan(0);
          expect(statusText.toLowerCase())
            .withContext(`In ${browserName}`)
            .toMatch(/collision|already|highlight/);
        })
      );
    });
  });

  describe("Custom bindings", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        `.page[data-page-number = "1"] .endOfContent`,
        null,
        null,
        {
          keyboardShortcuts: JSON.stringify({
            highlight: "b",
            underline: "u",
            "highlight.yellow": "1",
          }),
          highlightEditorColors: "yellow=#FFFF98,green=#53FFBC",
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must activate highlight with a remapped key", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await page.keyboard.press("b");
          await page.waitForSelector(".annotationEditorLayer.highlightEditing");
          expect(true).withContext(`In ${browserName}`).toBeTrue();
        })
      );
    });

    it("must apply a color shortcut", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await page.keyboard.press("1");
          await page.waitForSelector(".annotationEditorLayer.highlightEditing");

          // Color shortcuts set the next-highlight color and activate the tool.
          const selected = await page.evaluate(() => {
            const picker = document.querySelector(
              "#editorHighlightColorPicker button[aria-selected='true']"
            );
            return picker?.getAttribute("title") || picker?.dataset.color || "";
          });
          expect(String(selected).toLowerCase())
            .withContext(`In ${browserName}`)
            .toMatch(/yellow|#ffff98/);
        })
      );
    });
  });
});
