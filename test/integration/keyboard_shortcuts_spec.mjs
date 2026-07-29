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

    it("must capture a real key press into a binding", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await openKeyboardShortcuts(page);

          await page.click(
            '.shortcutsRow[data-action-id="rotateCw"] .shortcutsBinding'
          );
          await page.waitForSelector(
            '.shortcutsRow[data-action-id="rotateCw"] .shortcutsBinding.capturing'
          );

          // Use a real keyboard event — dialog.dispatchEvent alone misses the
          // window capture listener used after re-render focus loss.
          await page.keyboard.press("q");

          await page.waitForFunction(() => {
            const button = document.querySelector(
              '.shortcutsRow[data-action-id="rotateCw"] .shortcutsBinding'
            );
            return (
              button &&
              !button.classList.contains("capturing") &&
              /q/i.test(button.textContent || "")
            );
          });

          const label = await page.$eval(
            '.shortcutsRow[data-action-id="rotateCw"] .shortcutsBinding',
            el => el.textContent
          );
          expect(label.toLowerCase())
            .withContext(`In ${browserName}`)
            .toContain("q");
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

          await page.keyboard.press("h");

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

    it("must cancel capture on Escape", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await openKeyboardShortcuts(page);

          const before = await page.$eval(
            '.shortcutsRow[data-action-id="rotateCw"] .shortcutsBinding',
            el => el.textContent
          );

          await page.click(
            '.shortcutsRow[data-action-id="rotateCw"] .shortcutsBinding'
          );
          await page.waitForSelector(
            '.shortcutsRow[data-action-id="rotateCw"] .shortcutsBinding.capturing'
          );

          await page.keyboard.press("Escape");

          await page.waitForSelector(
            '.shortcutsRow[data-action-id="rotateCw"] .shortcutsBinding.capturing',
            { hidden: true }
          );

          const after = await page.$eval(
            '.shortcutsRow[data-action-id="rotateCw"] .shortcutsBinding',
            el => el.textContent
          );
          expect(after).withContext(`In ${browserName}`).toBe(before);

          // Dialog should still be open after canceling capture.
          const dialogOpen = await page.$eval(
            "#keyboardShortcutsDialog",
            el => !el.hidden && el.open !== false
          );
          expect(dialogOpen).withContext(`In ${browserName}`).toBeTrue();
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
            select: "s",
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

    it("must exit highlight/underline and activate select with s", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await page.keyboard.press("b");
          await page.waitForSelector(".annotationEditorLayer.highlightEditing");

          await page.keyboard.press("s");

          await page.waitForFunction(() => {
            const layer = document.querySelector(".annotationEditorLayer");
            return (
              layer &&
              !layer.classList.contains("highlightEditing") &&
              !layer.classList.contains("underlineEditing")
            );
          });

          const editing = await page.evaluate(() => {
            const layer = document.querySelector(".annotationEditorLayer");
            return {
              highlight: layer?.classList.contains("highlightEditing"),
              underline: layer?.classList.contains("underlineEditing"),
              selectChecked: document
                .getElementById("cursorSelectTool")
                ?.getAttribute("aria-checked"),
            };
          });
          expect(editing.highlight)
            .withContext(`In ${browserName}`)
            .toBeFalse();
          expect(editing.underline)
            .withContext(`In ${browserName}`)
            .toBeFalse();
          expect(editing.selectChecked)
            .withContext(`In ${browserName}`)
            .toBe("true");
        })
      );
    });

    it("must keep underline (u) working after select (s)", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await page.keyboard.press("b");
          await page.waitForSelector(".annotationEditorLayer.highlightEditing");
          await page.keyboard.press("s");
          await page.waitForFunction(() => {
            const layer = document.querySelector(".annotationEditorLayer");
            return layer && !layer.classList.contains("highlightEditing");
          });

          await page.keyboard.press("u");
          await page.waitForSelector(".annotationEditorLayer.underlineEditing");
          expect(true).withContext(`In ${browserName}`).toBeTrue();
        })
      );
    });
  });
});
