/* Copyright 2022 Mozilla Foundation
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

import {
  awaitPromise,
  clearEditors,
  closePages,
  getAnnotationSelector,
  getEditorSelector,
  getFirstSerialized,
  getRect,
  getSerialized,
  getSpanRectFromText,
  getXY,
  highlightSpan,
  kbBigMoveLeft,
  kbBigMoveUp,
  kbFocusNext,
  kbFocusPrevious,
  kbSave,
  kbUndo,
  loadAndWait,
  scrollIntoView,
  selectEditor,
  selectEditors,
  setCaretAt,
  switchToEditor,
  unselectEditor,
  waitAndClick,
  waitForAnnotationModeChanged,
  waitForPointerUp,
  waitForSelectedEditor,
  waitForSerialized,
  waitForTimeout,
} from "./test_utils.mjs";
import fs from "fs";
import path from "path";

const __dirname = import.meta.dirname;

const selectAll = selectEditors.bind(null, "highlight");

const switchToHighlight = switchToEditor.bind(null, "Highlight");

describe("Highlight Editor", () => {
  describe("Editor must be removed without exception", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must scroll and check that the draw layer is there", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await page.waitForFunction(
            `document.getElementById("viewer-alert").textContent === "Highlight added"`
          );

          const oneToOne = Array.from(new Array(13).keys(), n => n + 2).concat(
            Array.from(new Array(13).keys(), n => 13 - n)
          );
          for (const pageNumber of oneToOne) {
            await scrollIntoView(
              page,
              `.page[data-page-number = "${pageNumber}"]`
            );
          }

          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight`,
            { visible: true }
          );
        })
      );
    });
  });

  describe("Editor must keep selected", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must scroll and check that the highlight is selected", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlightOutline.selected`
          );

          const oneToOne = Array.from(new Array(13).keys(), n => n + 2).concat(
            Array.from(new Array(13).keys(), n => 13 - n)
          );
          for (const pageNumber of oneToOne) {
            await scrollIntoView(
              page,
              `.page[data-page-number = "${pageNumber}"]`
            );
          }

          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlightOutline.selected`
          );
        })
      );
    });
  });

  describe("The default color must have the correct value", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must highlight with red color", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlightOutline.selected`
          );

          const usedColor = await page.evaluate(() => {
            const highlight = document.querySelector(
              `.page[data-page-number = "1"] .canvasWrapper > svg.highlight`
            );
            return highlight.getAttribute("fill");
          });

          expect(usedColor).withContext(`In ${browserName}`).toEqual("#AB0000");
        })
      );
    });
  });

  describe("Invisible editor must change its color", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "yellow=#FFFF98,green=#53FFBC" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must scroll and change the color without exceptions", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlightOutline.selected`
          );

          for (const pageNumber of Array.from(
            new Array(13).keys(),
            n => n + 2
          )) {
            await scrollIntoView(
              page,
              `.page[data-page-number = "${pageNumber}"]`
            );
          }
          await page.waitForSelector(
            `.page[data-page-number = "14"] .textLayer .endOfContent`
          );

          await highlightSpan(page, 14, "References");
          const editorSelector = getEditorSelector(1);
          await page.waitForSelector(
            `.page[data-page-number = "14"] svg.highlightOutline.selected`
          );
          await selectAll(page);
          await page.waitForSelector(
            `${editorSelector} .editToolbar button.colorPicker`
          );
          await page.click(`${editorSelector} .editToolbar button.colorPicker`);
          await page.waitForSelector(
            `${editorSelector} .editToolbar button[title = "Green"]`
          );
          await page.click(
            `${editorSelector} .editToolbar button[title = "Green"]`
          );
          await page.waitForSelector(
            `.page[data-page-number = "14"] svg.highlight[fill = "#53FFBC"]`
          );

          for (const pageNumber of Array.from(
            new Array(13).keys(),
            n => 13 - n
          )) {
            await scrollIntoView(
              page,
              `.page[data-page-number = "${pageNumber}"]`
            );
          }

          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#53FFBC"]`
          );
        })
      );
    });
  });

  describe("Highlight data serialization", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must be correctly serialized", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlightOutline.selected`
          );

          await waitForSerialized(page, 1);
          const serialized = (await getSerialized(page))[0];
          expect(serialized.annotationType)
            .withContext(`In ${browserName}`)
            .toEqual(9);
          expect(serialized.color)
            .withContext(`In ${browserName}`)
            .toEqual([0xab, 0, 0]);

          // We don't check the quadPoints and outlines values because they're
          // dependent on the font used in the text layer.
          expect(serialized.quadPoints.length)
            .withContext(`In ${browserName}`)
            .toEqual(8);
          expect(serialized.outlines.length)
            .withContext(`In ${browserName}`)
            .toEqual(1);
          expect(serialized.outlines[0].length)
            .withContext(`In ${browserName}`)
            .toEqual(8);
        })
      );
    });
  });

  describe("Color picker and keyboard", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        {
          highlightEditorColors:
            "yellow=#FFFF00,green=#00FF00,blue=#0000FF,pink=#FF00FF,red=#FF0000",
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that we can use the keyboard to select a color", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);
          const sel = getEditorSelector(0);
          const dropdownHidden = `${sel} .editToolbar button.colorPicker .dropdown.hidden`;
          const dropdownVisible = `${sel} .editToolbar button.colorPicker .dropdown:not(.hidden)`;

          async function openColorPicker() {
            await page.waitForSelector(
              `${sel} .editToolbar button.colorPicker`
            );
            await page.click(`${sel} .editToolbar button.colorPicker`);
            await page.waitForSelector(dropdownVisible);
            // Focus the selected swatch so arrow keys navigate options
            // instead of closing the menu from the trigger button.
            await page.focus(
              `${sel} .editToolbar button[aria-selected="true"]`
            );
          }

          await highlightSpan(page, 1, "Abstract");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlightOutline.selected`
          );

          await openColorPicker();
          await page.waitForSelector(
            `${sel} .editToolbar button[title = "Red"]`
          );
          await page.click(`${sel} .editToolbar button[title = "Red"]`);
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#FF0000"]`
          );
          await page.waitForSelector(dropdownHidden);

          await openColorPicker();
          await page.keyboard.press("ArrowUp");
          await page.waitForSelector(
            `${sel} .editToolbar button[title = "Pink"]:focus`
          );
          await page.keyboard.press("Enter");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#FF00FF"]`
          );
          await page.waitForSelector(dropdownHidden);

          await openColorPicker();
          await page.keyboard.press("ArrowUp");
          await page.waitForSelector(
            `${sel} .editToolbar button[title = "Blue"]:focus`
          );
          await page.keyboard.press(" ");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#0000FF"]`
          );
          await page.waitForSelector(dropdownHidden);

          await openColorPicker();
          await page.keyboard.press("ArrowLeft");
          await page.waitForSelector(
            `${sel} .editToolbar button[title = "Green"]:focus`
          );
          await page.keyboard.press("Enter");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#00FF00"]`
          );
          await page.waitForSelector(dropdownHidden);

          await openColorPicker();
          await page.keyboard.press("ArrowRight");
          await page.waitForSelector(
            `${sel} .editToolbar button[title = "Blue"]:focus`
          );
          await page.keyboard.press("Enter");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#0000FF"]`
          );
          await page.waitForSelector(dropdownHidden);

          await openColorPicker();
          await page.keyboard.press("ArrowDown");
          await page.waitForSelector(
            `${sel} .editToolbar button[title = "Pink"]:focus`
          );
          await page.keyboard.press(" ");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#FF00FF"]`
          );
          await page.waitForSelector(dropdownHidden);

          await openColorPicker();
          for (let i = 0; i < 4; i++) {
            await page.keyboard.press("ArrowUp");
          }
          await page.waitForSelector(dropdownHidden);
          await page.keyboard.press("ArrowDown");
          await page.waitForSelector(dropdownVisible);
          await page.keyboard.press("ArrowUp");
          await page.waitForSelector(dropdownHidden);
          await page.keyboard.press(" ");
          await page.waitForSelector(dropdownVisible);
        })
      );
    });
  });

  describe("Text highlights aren't draggable", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that a text highlight don't move when arrows are pressed", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          const editorSelector = getEditorSelector(0);
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlightOutline.selected`
          );
          await page.focus(editorSelector);

          const xy = await getXY(page, editorSelector);
          for (let i = 0; i < 5; i++) {
            await kbBigMoveLeft(page);
          }
          expect(await getXY(page, editorSelector))
            .withContext(`In ${browserName}`)
            .toEqual(xy);

          for (let i = 0; i < 5; i++) {
            await kbBigMoveUp(page);
          }
          expect(await getXY(page, editorSelector))
            .withContext(`In ${browserName}`)
            .toEqual(xy);
        })
      );
    });
  });

  describe("Color picker and click outside", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that the dropdown is hidden", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);
          const sel = getEditorSelector(0);

          await highlightSpan(page, 1, "Abstract");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlightOutline.selected`
          );

          await page.waitForSelector(`${sel} .editToolbar button.colorPicker`);
          await page.click(`${sel} .editToolbar button.colorPicker`);
          await page.waitForSelector(
            `${sel} .editToolbar button[title = "Red"]`
          );
          const rect = await getSpanRectFromText(page, 1, "Abstract");
          await page.mouse.click(rect.x, rect.y - rect.height);
          await page.waitForSelector(
            `${sel} .editToolbar button.colorPicker .dropdown.hidden`
          );
        })
      );
    });
  });

  describe("Color picker can annoy the user when selecting some text", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that editor is unselected when the mouse is down on the text layer", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);
          const sel = getEditorSelector(0);

          await highlightSpan(page, 1, "Abstract");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlightOutline.selected`
          );

          await page.waitForSelector(`${sel} .editToolbar button.colorPicker`);

          const rect = await getSpanRectFromText(page, 1, "Abstract");
          const x = rect.x + rect.width / 2;
          const y = rect.y + rect.height / 2;
          await page.mouse.click(x, y - rect.height);
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlightOutline:not(.selected)`
          );
        })
      );
    });
  });

  describe("Free highlight thickness can be changed", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "empty.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "yellow=#000000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that the thickness is correctly updated", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          const rect = await getRect(page, ".annotationEditorLayer");

          for (let i = 0; i < 3; i++) {
            const x = rect.x + 120 + i * 120;
            const y = rect.y + 120 + i * 120;
            const clickHandle = await waitForPointerUp(page);
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + 100, y + 100);
            await page.mouse.up();
            await awaitPromise(clickHandle);

            await page.waitForSelector(getEditorSelector(i));
          }

          let value = 12;
          await waitForSerialized(page, 3);
          let serialized = await getSerialized(page);
          expect(serialized.map(x => x.thickness))
            .withContext(`In ${browserName}`)
            .toEqual([value, value, value]);

          await selectAll(page);

          const editorSelector = getEditorSelector(0);
          const { width: prevWidth } = await getRect(page, editorSelector);

          value = 24;
          await page.evaluate(val => {
            window.PDFViewerApplication.eventBus.dispatch(
              "switchannotationeditorparams",
              {
                source: null,
                type: window.pdfjsLib.AnnotationEditorParamsType
                  .HIGHLIGHT_THICKNESS,
                value: val,
              }
            );
          }, value);

          await page.waitForFunction(
            (w, sel) =>
              document.querySelector(sel).getBoundingClientRect().width !== w,
            {},
            prevWidth,
            editorSelector
          );

          await waitForSerialized(page, 3);
          serialized = await getSerialized(page);
          expect(serialized.map(x => x.thickness))
            .withContext(`In ${browserName}`)
            .toEqual([value, value, value]);
        })
      );
    });
  });

  describe("Highlight with the keyboard", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that some text has been highlighted", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);
          const sel = getEditorSelector(0);

          const spanRect = await getRect(
            page,
            `.page[data-page-number="1"] > .textLayer > span`
          );
          await page.keyboard.down("Shift");
          await page.mouse.click(
            spanRect.x + 1,
            spanRect.y + spanRect.height / 2,
            { count: 2 }
          );
          for (let i = 0; i < 6; i++) {
            await page.keyboard.press("ArrowRight");
          }
          await page.keyboard.press("ArrowDown");
          // Here and elsewhere, we add a small delay between press and release
          // to make sure that a keyup event for Shift is triggered after
          // selectionchange (it's why adding the delay on the last before
          // releasing shift is enough).
          // It works with a value of 10ms, but we use 100ms to be sure.
          await page.keyboard.press("ArrowDown", { delay: 100 });
          await page.keyboard.up("Shift");

          await page.waitForSelector(sel);

          const [w, h] = await page.evaluate(s => {
            const {
              style: { width, height },
            } = document.querySelector(s);
            return [parseFloat(width), parseFloat(height)];
          }, sel);

          // w & h are the width and height of the highlight in percent.
          // We expect the highlight to be around 73% wide and 9% high.
          // We allow a 2% margin of error because of the font used in the text
          // layer we can't be sure of the dimensions.
          expect(Math.abs(w - 73) <= 2)
            .withContext(`In ${browserName}`)
            .toBeTrue();
          expect(Math.abs(h - 9) <= 2)
            .withContext(`In ${browserName}`)
            .toBeTrue();
        })
      );
    });
  });

  describe("Free highlight is drawn at the right place after having been rotated (bug 1879108)", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "empty.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "yellow=#000000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that highlight is at the correct position", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          const rect = await getRect(page, ".annotationEditorLayer");

          const clickHandle = await waitForPointerUp(page);
          await page.mouse.move(rect.x + 120, rect.y + 120);
          await page.mouse.down();
          await page.mouse.move(rect.x + 220, rect.y + 220);
          await page.mouse.up();
          await awaitPromise(clickHandle);

          const editorSelector = getEditorSelector(0);
          await page.waitForSelector(editorSelector);

          await page.evaluate(() => {
            window.PDFViewerApplication.rotatePages(90);
          });
          await page.waitForSelector(
            ".annotationEditorLayer[data-main-rotation='90']"
          );
          await selectAll(page);

          const { width: prevWidth } = await getRect(page, editorSelector);

          await page.evaluate(val => {
            window.PDFViewerApplication.eventBus.dispatch(
              "switchannotationeditorparams",
              {
                source: null,
                type: window.pdfjsLib.AnnotationEditorParamsType
                  .HIGHLIGHT_THICKNESS,
                value: val,
              }
            );
          }, 24);

          await page.waitForFunction(
            (w, sel) =>
              document.querySelector(sel).getBoundingClientRect().width !== w,
            {},
            prevWidth,
            editorSelector
          );

          const rectDiv = await getRect(page, editorSelector);
          const rectSVG = await getRect(page, "svg.highlight.free");

          expect(Math.abs(rectDiv.x - rectSVG.x) <= 2)
            .withContext(`In ${browserName}`)
            .toBeTrue();
          expect(Math.abs(rectDiv.y - rectSVG.y) <= 2)
            .withContext(`In ${browserName}`)
            .toBeTrue();
          expect(Math.abs(rectDiv.height - rectSVG.height) <= 2)
            .withContext(`In ${browserName}`)
            .toBeTrue();
          expect(Math.abs(rectDiv.width - rectSVG.width) <= 2)
            .withContext(`In ${browserName}`)
            .toBeTrue();
        })
      );
    });
  });

  describe("Highlight links", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "bug1868759.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that it's possible to highlight a part of a link", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Questions courantes", 0.75, 0.5);
          const usedColor = await page.evaluate(() => {
            const highlight = document.querySelector(
              `.page[data-page-number = "1"] .canvasWrapper > svg.highlight`
            );
            return highlight.getAttribute("fill");
          });

          expect(usedColor).withContext(`In ${browserName}`).toEqual("#AB0000");
        })
      );
    });
  });

  describe("Highlight forms", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "issue12233.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that it's possible to highlight a part of a form", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          const rect1 = await getRect(page, "#pdfjs_internal_id_5R");
          const rect2 = await getRect(page, "#pdfjs_internal_id_16R");

          const x1 = rect1.x + rect1.width / 2;
          const y1 = rect1.y + rect1.height / 2;
          const x2 = rect2.x + rect2.width / 2;
          const y2 = rect2.y + rect2.height / 2;
          const clickHandle = await waitForPointerUp(page);
          await page.mouse.move(x1, y1);
          await page.mouse.down();
          await page.mouse.move(x2, y2);
          await page.mouse.up();
          await awaitPromise(clickHandle);

          await page.waitForSelector(getEditorSelector(0));
          const usedColor = await page.evaluate(() => {
            const highlight = document.querySelector(
              `.page[data-page-number = "1"] .canvasWrapper > svg.highlight`
            );
            return highlight.getAttribute("fill");
          });

          expect(usedColor).withContext(`In ${browserName}`).toEqual("#AB0000");
        })
      );
    });
  });

  describe("Send a message when some text is selected", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        `.page[data-page-number = "1"] .endOfContent`,
        null,
        {
          eventBusSetup: eventBus => {
            window.editingEvents = [];
            eventBus.on("editingstateschanged", ({ details }) => {
              window.editingEvents.push(details);
            });
          },
        },
        { highlightEditorColors: "red=#AB0000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that a message is sent on selection", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          const rect = await getSpanRectFromText(page, 1, "Abstract");
          const x = rect.x + rect.width / 2;
          const y = rect.y + rect.height / 2;
          await page.mouse.click(x, y, { count: 2, delay: 100 });
          await page.waitForFunction(() => window.editingEvents.length > 0);

          let editingEvent = await page.evaluate(() => {
            const e = window.editingEvents[0];
            window.editingEvents.length = 0;
            return e;
          });
          expect(editingEvent.isEditing)
            .withContext(`In ${browserName}`)
            .toBeFalse();
          expect(editingEvent.hasSelectedText)
            .withContext(`In ${browserName}`)
            .toBeTrue();

          // Click somewhere to unselect the current selection.
          await page.mouse.click(rect.x + rect.width + 10, y, { count: 1 });
          await page.waitForFunction(() => window.editingEvents.length > 0);
          editingEvent = await page.evaluate(() => {
            const e = window.editingEvents[0];
            window.editingEvents.length = 0;
            return e;
          });
          expect(editingEvent.hasSelectedText)
            .withContext(`In ${browserName}`)
            .toBeFalse();

          await page.mouse.click(x, y, { count: 2, delay: 100 });
          await page.waitForFunction(() => window.editingEvents.length > 0);

          await page.evaluate(() => {
            window.PDFViewerApplication.eventBus.dispatch("editingaction", {
              name: "highlightSelection",
            });
          });

          await page.waitForSelector(getEditorSelector(0));
          const usedColor = await page.evaluate(() => {
            const highlight = document.querySelector(
              `.page[data-page-number = "1"] .canvasWrapper > svg.highlight`
            );
            return highlight.getAttribute("fill");
          });

          expect(usedColor).withContext(`In ${browserName}`).toEqual("#AB0000");
        })
      );
    });
  });

  describe("Highlight and caret browsing", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        {
          eventBusSetup: eventBus => {
            eventBus.on("annotationeditoruimanager", ({ uiManager }) => {
              window.uiManager = uiManager;
            });
          },
        },
        {
          highlightEditorColors: "red=#AB0000",
          supportsCaretBrowsingMode: true,
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that the caret can move a highlighted text", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          const editorSelector = getEditorSelector(0);
          await unselectEditor(page, editorSelector);

          await setCaretAt(
            page,
            1,
            "Dynamic languages such as JavaScript are more difﬁcult to com-",
            1
          );
          await page.keyboard.press("ArrowUp");
          const [text, offset] = await page.evaluate(() => {
            const selection = window.getSelection();
            return [selection.anchorNode.textContent, selection.anchorOffset];
          });

          expect(text).withContext(`In ${browserName}`).toEqual("Abstract");
          expect(offset).withContext(`In ${browserName}`).toEqual(1);
        })
      );
    });

    it("must check that selection is correctly highlighted on arrow down key pressed", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await setCaretAt(
            page,
            1,
            "Dynamic languages such as JavaScript are more difﬁcult to com-",
            15
          );
          await page.keyboard.down("Shift");
          await page.keyboard.press("ArrowDown", { delay: 100 });
          await page.keyboard.up("Shift");

          await page.waitForSelector(getEditorSelector(0));
          const usedColor = await page.evaluate(() => {
            const highlight = document.querySelector(
              `.page[data-page-number = "1"] .canvasWrapper > svg.highlight`
            );
            return highlight.getAttribute("fill");
          });

          expect(usedColor).withContext(`In ${browserName}`).toEqual("#AB0000");
        })
      );
    });

    it("must check that an highlight can be left with the keyboard", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          if (browserName === "chrome") {
            pending("Caret browsing mode cannot be used in Chrome.");
          }

          await switchToHighlight(page);

          let rect = await getSpanRectFromText(
            page,
            1,
            "Dynamic languages such as JavaScript are more difﬁcult to com-"
          );
          await page.mouse.click(rect.x + 5, rect.y + rect.height / 2);
          await page.keyboard.down("Shift");
          for (let i = 0; i < 10; i++) {
            await page.keyboard.press("ArrowRight");
          }
          const focusOffset = await page.evaluate(
            () => window.getSelection().focusOffset
          );
          await page.keyboard.up("Shift");

          await page.waitForSelector(getEditorSelector(0));

          for (let i = 0; i < 5; i++) {
            await page.keyboard.press("ArrowRight");
          }

          let offset = await page.evaluate(
            () => window.getSelection().anchorOffset
          );

          expect(offset)
            .withContext(`In ${browserName}`)
            .toEqual(focusOffset + 4);

          rect = await getSpanRectFromText(
            page,
            1,
            "experience and enable a new generation of applications, virtual ma-"
          );
          await page.mouse.click(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2
          );
          await page.keyboard.down("Shift");
          for (let i = 0; i < 10; i++) {
            await page.keyboard.press("ArrowRight");
          }
          const anchorOffset = await page.evaluate(
            () => window.getSelection().anchorOffset
          );
          await page.keyboard.up("Shift");

          await page.waitForSelector(getEditorSelector(1));

          for (let i = 0; i < 5; i++) {
            await page.keyboard.press("ArrowLeft");
          }

          offset = await page.evaluate(
            () => window.getSelection().anchorOffset
          );

          expect(offset)
            .withContext(`In ${browserName}`)
            .toEqual(anchorOffset - 4);
        })
      );
    });
  });

  describe("Editor must be removed in using the space key on the delete button", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that the highlight has been deleted", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          const editorSelector = getEditorSelector(0);
          await waitForSerialized(page, 1);
          await page.waitForSelector(`${editorSelector} button.deleteButton`);

          await page.focus(`${editorSelector} button.deleteButton`);
          await page.keyboard.press(" ");

          await waitForSerialized(page, 0);
        })
      );
    });
  });

  describe("Thickness must be enabled when there's no selected highlights", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check the thickness input state", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          const editorSelector = getEditorSelector(0);

          const rect = await getRect(page, ".annotationEditorLayer");

          const clickHandle = await waitForPointerUp(page);
          await page.mouse.move(rect.x + 5, rect.y + 5);
          await page.mouse.down();
          await page.mouse.move(rect.x + 100, rect.y + 100);
          await page.mouse.up();
          await awaitPromise(clickHandle);

          await page.waitForSelector(getEditorSelector(1));
          await page.waitForSelector(
            "#editorFreeHighlightThickness:not([disabled])"
          );

          await page.click(editorSelector);
          await page.waitForSelector(editorSelector);
          await page.waitForSelector("#editorFreeHighlightThickness[disabled]");

          await switchToHighlight(page, /* disable */ true);
          await switchToHighlight(page);

          await page.waitForSelector(
            "#editorFreeHighlightThickness:not([disabled])"
          );
        })
      );
    });
  });

  describe("Straight line highlighting", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must draw a straight line instead of a freehand path when the straight line mode is toggled on", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          const rect = await getRect(page, ".annotationEditorLayer");
          const x = rect.x + 20;
          const y1 = rect.y + 20;
          const y2 = rect.y + 220;

          const drag = async () => {
            const clickHandle = await waitForPointerUp(page);
            await page.mouse.move(x, y1);
            await page.mouse.down();
            for (let y = y1; y <= y2; y += (y2 - y1) / 10) {
              await page.mouse.move(x, Math.round(y));
            }
            await page.mouse.up();
            await awaitPromise(clickHandle);
          };

          // By default (toggle off) dragging the pointer must still produce
          // the current freehand behaviour, i.e. more than just the two
          // (start/end) points.
          await drag();
          await waitForSerialized(page, 1);
          let points = await getFirstSerialized(
            page,
            e => e.outlines.points[0]
          );
          expect(points.length > 4)
            .withContext(`In ${browserName}`)
            .toBeTrue();

          // Toggle while the free highlight is still selected — the drawing
          // mode default must update even though params are routed to the
          // selected editor instance.
          await page.waitForSelector(
            "#editorHighlightStraightLineButton[aria-pressed=false]"
          );
          await page.click("#editorHighlightStraightLineButton");
          await page.waitForSelector(
            "#editorHighlightStraightLineButton[aria-pressed=true]"
          );

          await clearEditors("highlight", page);

          // Min thickness (2pt) must still produce a visible two-point stroke.
          await page.waitForSelector(
            "#editorFreeHighlightThickness:not([disabled])"
          );
          await page.$eval("#editorFreeHighlightThickness", el => {
            el.value = 2;
            el.dispatchEvent(new Event("input", { bubbles: true }));
          });

          await drag();
          await waitForSerialized(page, 1);
          points = await getFirstSerialized(page, e => e.outlines.points[0]);
          expect(points.length).withContext(`In ${browserName}`).toEqual(4);

          // Freehand must still work after toggling straight-line off.
          await page.click("#editorHighlightStraightLineButton");
          await page.waitForSelector(
            "#editorHighlightStraightLineButton[aria-pressed=false]"
          );
          await clearEditors("highlight", page);
          await drag();
          await waitForSerialized(page, 1);
          points = await getFirstSerialized(page, e => e.outlines.points[0]);
          expect(points.length > 4)
            .withContext(`In ${browserName} after toggle off`)
            .toBeTrue();
        })
      );
    });
  });

  describe("Quadpoints must be correct", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that the quadpoints for an highlight are almost correct", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Languages");
          await waitForSerialized(page, 1);
          const quadPoints = await getFirstSerialized(page, e => e.quadPoints);
          // Expected quadPoints tL, tR, bL, bR with bL coordinate.
          const expected = [263, 696, 346, 696, 263, 674, 346, 674];
          expect(quadPoints.every((x, i) => Math.abs(x - expected[i]) <= 5))
            .withContext(`In ${browserName}`)
            .toBeTrue();
        })
      );
    });
  });

  describe("Quadpoints must be correct when they're in a translated page", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("issue18360.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that the quadpoints for an highlight are almost correct", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Hello World", 0.25);
          await waitForSerialized(page, 1);
          const quadPoints = await getFirstSerialized(page, e => e.quadPoints);
          // Expected quadPoints tL, tR, bL, bR with bL coordinate.
          const expected = [148, 637, 176, 637, 148, 624, 176, 624];
          expect(quadPoints.every((x, i) => Math.abs(x - expected[i]) <= 5))
            .withContext(`In ${browserName} (got ${quadPoints})`)
            .toBeTrue();
        })
      );
    });
  });

  describe("Editor must be unselected when the color picker is Escaped", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that the highlight editor is unselected", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          const editorSelector = getEditorSelector(0);
          await page.focus(`${editorSelector} button.colorPicker`);

          await page.keyboard.press("Escape");
          await page.focus(`${editorSelector}:not(selectedEditor)`);
        })
      );
    });
  });

  describe("Highlight editor mustn't be moved when close to the page limits", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("empty.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check the editor coordinates", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          const rect = await getRect(page, ".annotationEditorLayer");

          const clickHandle = await waitForPointerUp(page);
          await page.mouse.move(rect.x + 1, rect.y + 50);
          await page.mouse.down();
          await page.mouse.move(rect.x + 1, rect.y + 100);
          await page.mouse.up();
          await awaitPromise(clickHandle);

          const editorSelector = getEditorSelector(0);
          await page.waitForSelector(editorSelector);

          const { x: editorX } = await getRect(page, editorSelector);

          expect(editorX < rect.x)
            .withContext(`In ${browserName}`)
            .toBeTrue();
        })
      );
    });
  });

  describe("Show/hide all the highlights", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that the highlights are correctly hidden/shown", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          const rect = await getRect(page, ".annotationEditorLayer");
          const clickHandle = await waitForPointerUp(page);
          await page.mouse.move(rect.x + 20, rect.y + 20);
          await page.mouse.down();
          await page.mouse.move(rect.x + 20, rect.y + 120);
          await page.mouse.up();
          await awaitPromise(clickHandle);

          const firstEditorSelector = getEditorSelector(0);
          await page.waitForSelector(firstEditorSelector);

          await highlightSpan(page, 1, "Languages");
          const secondEditorSelector = getEditorSelector(1);

          await page.click("#editorHighlightShowAll");
          await page.waitForSelector(`${firstEditorSelector}.hidden`);
          await page.waitForSelector(`${secondEditorSelector}.hidden`);

          await page.click("#editorHighlightShowAll");
          await page.waitForSelector(`${firstEditorSelector}:not(.hidden)`);
          await page.waitForSelector(`${secondEditorSelector}:not(.hidden)`);

          await page.click("#editorHighlightShowAll");
          await page.waitForSelector(`${firstEditorSelector}.hidden`);
          await page.waitForSelector(`${secondEditorSelector}.hidden`);

          const oneToOne = Array.from(new Array(13).keys(), n => n + 2).concat(
            Array.from(new Array(13).keys(), n => 13 - n)
          );
          for (const pageNumber of oneToOne) {
            await scrollIntoView(
              page,
              `.page[data-page-number = "${pageNumber}"]`
            );
            if (pageNumber === 14) {
              await page.click("#editorHighlightShowAll");
            }
          }

          await page.waitForSelector(`${firstEditorSelector}:not(.hidden)`);
          await page.waitForSelector(`${secondEditorSelector}:not(.hidden)`);
        })
      );
    });
  });

  describe("Highlight from floating highlight button", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that clicking on the highlight floating button triggers an highlight", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          async function floatingHighlight(text, editorId) {
            const rect = await getSpanRectFromText(page, 1, text);
            const x = rect.x + rect.width / 2;
            const y = rect.y + rect.height / 2;
            await page.mouse.click(x, y, { count: 2, delay: 100 });

            await page.waitForSelector(".textLayer .highlightButton");
            await page.click(".textLayer .highlightButton");

            await page.waitForSelector(getEditorSelector(editorId));
            const usedColor = await page.evaluate(() => {
              const highlight = document.querySelector(
                `.page[data-page-number = "1"] .canvasWrapper > svg.highlight`
              );
              return highlight.getAttribute("fill");
            });

            expect(usedColor)
              .withContext(`In ${browserName}`)
              .toEqual("#AB0000");
          }

          await floatingHighlight("Abstract", 0);

          // Disable editing mode, and highlight another string (issue 19369).
          await switchToHighlight(page, /* disable */ true);
          await floatingHighlight("Introduction", 1);
        })
      );
    });
  });

  describe("Text layer must have the focus before highlights", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check the focus order", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await highlightSpan(page, 1, "Languages");

          const editorSelector = getEditorSelector(1);
          await page.focus(editorSelector);

          await kbFocusPrevious(page);
          await page.waitForSelector(
            `.page[data-page-number="1"] > .textLayer:focus`
          );

          await kbFocusNext(page);
          await page.waitForSelector(`${editorSelector}:focus`);
        })
      );
    });
  });

  describe("Undo a highlight", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that a highlight can be undone", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          const editorSelector = getEditorSelector(0);
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);

          await kbUndo(page);
          await waitForSerialized(page, 1);
          await page.waitForSelector(editorSelector);
        })
      );
    });
  });

  describe("Delete a highlight and undo it an other page", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        {
          highlightEditorColors:
            "yellow=#FFFF00,green=#00FF00,blue=#0000FF,pink=#FF00FF,red=#FF0000",
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that a highlight can be undone", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          const editorSelector = getEditorSelector(0);
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);

          const twoToFourteen = Array.from(new Array(13).keys(), n => n + 2);
          for (const pageNumber of twoToFourteen) {
            const pageSelector = `.page[data-page-number = "${pageNumber}"]`;
            await scrollIntoView(page, pageSelector);
          }

          await kbUndo(page);
          await waitForSerialized(page, 1);

          const thirteenToOne = Array.from(new Array(13).keys(), n => 13 - n);
          for (const pageNumber of thirteenToOne) {
            const pageSelector = `.page[data-page-number = "${pageNumber}"]`;
            await scrollIntoView(page, pageSelector);
          }

          await page.waitForSelector(editorSelector);
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#FFFF00"]`
          );
        })
      );
    });
  });

  describe("Delete a highlight, scroll and undo it", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        {
          highlightEditorColors:
            "yellow=#FFFF00,green=#00FF00,blue=#0000FF,pink=#FF00FF,red=#FF0000",
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that a highlight can be undone", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          const editorSelector = getEditorSelector(0);
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);

          const twoToOne = Array.from(new Array(13).keys(), n => n + 2).concat(
            Array.from(new Array(13).keys(), n => 13 - n)
          );
          for (const pageNumber of twoToOne) {
            const pageSelector = `.page[data-page-number = "${pageNumber}"]`;
            await scrollIntoView(page, pageSelector);
          }

          await kbUndo(page);
          await waitForSerialized(page, 1);
          await page.waitForSelector(editorSelector);
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#FFFF00"]`
          );
        })
      );
    });
  });

  describe("Use a toolbar overlapping an other highlight", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        {
          highlightEditorColors:
            "yellow=#FFFF00,green=#00FF00,blue=#0000FF,pink=#FF00FF,red=#FF0000",
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that the toolbar is usable", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await setCaretAt(
            page,
            1,
            "Dynamic languages such as JavaScript are more difﬁcult to com-",
            0
          );
          await page.keyboard.down("Shift");
          for (let i = 0; i < 3; i++) {
            await page.keyboard.press("ArrowDown", { delay: 100 });
          }
          await page.keyboard.up("Shift");

          const editorSelector = getEditorSelector(0);
          await page.waitForSelector(editorSelector);

          await setCaretAt(
            page,
            1,
            "handle all possible type combinations at runtime. We present an al-",
            0
          );
          await page.keyboard.down("Shift");
          for (let i = 0; i < 3; i++) {
            await page.keyboard.press("ArrowDown", { delay: 100 });
          }
          await page.keyboard.up("Shift");
          await page.waitForSelector(getEditorSelector(1));

          const rect = await getRect(page, editorSelector);
          const x = rect.x + rect.width / 2;
          const y = rect.y + rect.height / 2;
          await page.mouse.click(x, y);

          await page.waitForSelector(
            `${editorSelector} .editToolbar button.colorPicker`
          );

          await page.click(`${editorSelector} .editToolbar button.colorPicker`);
          await page.waitForSelector(
            `${editorSelector} .editToolbar button[title = "Green"]`
          );
          await page.click(
            `${editorSelector} .editToolbar button[title = "Green"]`
          );
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#00FF00"]`
          );
        })
      );
    });
  });

  describe("Draw a free highlight with the pointer hovering an existing highlight", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that an existing highlight is ignored on hovering", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          const editorSelector = getEditorSelector(0);
          await waitForSerialized(page, 1);
          await unselectEditor(page, editorSelector);

          const clickHandle = await waitForPointerUp(page);
          const rect = await getSpanRectFromText(page, 1, "Abstract");
          const x = rect.x + rect.width / 2;
          let y = rect.y - rect.height;
          await page.mouse.move(x, y);

          const counterHandle = await page.evaluateHandle(sel => {
            const el = document.querySelector(sel);
            const counter = { count: 0 };
            el.addEventListener(
              "pointerover",
              () => {
                counter.count += 1;
              },
              { capture: true }
            );
            return counter;
          }, editorSelector);

          await page.mouse.down();
          await page.waitForSelector(
            `.page[data-page-number = "1"] .annotationEditorLayer.drawing`
          );
          for (
            const endY = rect.y + 2 * rect.height;
            y <= endY;
            y += rect.height / 10
          ) {
            await page.mouse.move(x, Math.round(y));
          }
          await page.mouse.up();
          await awaitPromise(clickHandle);
          await page.waitForSelector(
            `.page[data-page-number = "1"] .annotationEditorLayer:not(.drawing)`
          );

          const { count } = await counterHandle.jsonValue();
          expect(count).withContext(`In ${browserName}`).toEqual(0);
        })
      );
    });
  });

  describe("Select text with the pointer hovering an existing highlight", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that an existing highlight is ignored on hovering", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          const rect = await getSpanRectFromText(
            page,
            1,
            "ternative compilation technique for dynamically-typed languages"
          );
          const editorSelector = getEditorSelector(0);
          const x = Math.round(rect.x + rect.width / 2);
          let y = Math.round(rect.y + rect.height / 2);
          await page.mouse.click(x, y, { count: 3, delay: 100 });
          await page.waitForSelector(editorSelector);
          await waitForSerialized(page, 1);
          await unselectEditor(page, editorSelector);

          const clickHandle = await waitForPointerUp(page);
          y = rect.y - 3 * rect.height;
          await page.mouse.move(x, y);

          const counterHandle = await page.evaluateHandle(sel => {
            const el = document.querySelector(sel);
            const counter = { count: 0 };
            el.addEventListener(
              "pointerover",
              () => {
                counter.count += 1;
              },
              { capture: true }
            );
            return counter;
          }, editorSelector);

          await page.mouse.down();
          await page.waitForSelector(
            `.page[data-page-number = "1"] .textLayer.selecting`
          );
          for (
            const endY = rect.y + 3 * rect.height;
            y <= endY;
            y += rect.height / 10
          ) {
            await page.mouse.move(x, Math.round(y));
          }
          await page.mouse.up();
          await awaitPromise(clickHandle);
          await page.waitForSelector(
            `.page[data-page-number = "1"] .textLayer:not(.selecting)`
          );

          const { count } = await counterHandle.jsonValue();
          expect(count).withContext(`In ${browserName}`).toEqual(0);
        })
      );
    });
  });

  describe("Highlight with the floating button in a pdf containing a FreeText", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "file_pdfjs_test.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that the highlight is created", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          const rect = await getSpanRectFromText(page, 1, "In production");
          const x = rect.x + rect.width / 2;
          const y = rect.y + rect.height / 2;
          await page.mouse.click(x, y, { count: 3, delay: 100 });

          await page.waitForSelector(".textLayer .highlightButton");
          await page.click(".textLayer .highlightButton");

          await page.waitForSelector(getEditorSelector(0));
          const usedColor = await page.evaluate(() => {
            const highlight = document.querySelector(
              `.page[data-page-number = "1"] .canvasWrapper > svg.highlight`
            );
            return highlight.getAttribute("fill");
          });

          expect(usedColor).withContext(`In ${browserName}`).toEqual("#AB0000");
        })
      );
    });
  });

  describe("Highlight (edit existing in double clicking on it)", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "highlights.pdf",
        ".annotationEditorLayer",
        null,
        null,
        {
          highlightEditorColors:
            "yellow=#FFFF00,green=#00FF00,blue=#0000FF,pink=#FF00FF,red=#FF0102",
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must change the color of an highlight", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          const modeChangedHandle = await waitForAnnotationModeChanged(page);
          await waitAndClick(page, getAnnotationSelector("687R"), { count: 2 });
          await awaitPromise(modeChangedHandle);
          await page.waitForSelector("#highlightParamsToolbarContainer");

          const editorSelector = getEditorSelector(5);
          await page.waitForSelector(editorSelector);

          await waitAndClick(
            page,
            `${editorSelector} .editToolbar button.colorPicker`
          );
          await waitAndClick(
            page,
            `${editorSelector} .editToolbar button[title = "Red"]`
          );
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#FF0102"]`
          );
        })
      );
    });
  });

  describe("Highlight (delete an existing annotation)", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "highlight_popup.pdf",
        ".annotationEditorLayer"
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must delete an existing annotation and its popup", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          const modeChangedHandle = await waitForAnnotationModeChanged(page);
          await waitAndClick(page, getAnnotationSelector("24R"), { count: 2 });
          await awaitPromise(modeChangedHandle);
          await page.waitForSelector("#highlightParamsToolbarContainer");

          const editorSelector = getEditorSelector(0);
          await page.waitForSelector(editorSelector);
          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 1);

          const serialized = await getSerialized(page);
          expect(serialized)
            .withContext(`In ${browserName}`)
            .toEqual([
              {
                pageIndex: 0,
                id: "24R",
                deleted: true,
                popupRef: "25R",
              },
            ]);
        })
      );
    });
  });

  describe("Free Highlight (edit existing in double clicking on it)", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "highlights.pdf",
        ".annotationEditorLayer",
        null,
        null,
        {
          highlightEditorColors:
            "yellow=#FFFF00,green=#00FF00,blue=#0000FF,pink=#FF00FF,red=#FF0102",
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must change the color of a free highlight", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          const modeChangedHandle = await waitForAnnotationModeChanged(page);
          await page.click(getAnnotationSelector("693R"), { count: 2 });
          await awaitPromise(modeChangedHandle);
          await page.waitForSelector("#highlightParamsToolbarContainer");

          const editorSelector = getEditorSelector(6);
          await page.waitForSelector(editorSelector);
          await page.focus(editorSelector);
          await waitForSelectedEditor(page, editorSelector);

          await waitAndClick(
            page,
            `${editorSelector} .editToolbar button.colorPicker`
          );
          await waitAndClick(
            page,
            `${editorSelector} .editToolbar button[title = "Red"]`
          );
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#FF0102"]`
          );
        })
      );
    });
  });

  describe("Highlight editor mustn't throw when disabled", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "annotation-highlight.pdf",
        ".annotationEditorLayer"
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must enable & disable highlight mode successfully", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          const modeChangedHandle = await waitForAnnotationModeChanged(page);
          await switchToHighlight(page);
          await awaitPromise(modeChangedHandle);

          await page.waitForSelector("#highlightParamsToolbarContainer", {
            visible: true,
          });
          await switchToHighlight(page, /* disable */ true);
          await page.waitForSelector("#highlightParamsToolbarContainer", {
            visible: false,
          });
        })
      );
    });
  });

  describe("Free Highlight with an image in the struct tree", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "bug1708040.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that it's possible to draw on an image in a struct tree", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          const rect = await getRect(page, `.textLayer span[role="img"]`);

          const x = rect.x + rect.width / 2;
          const y = rect.y + rect.height / 2;
          const clickHandle = await waitForPointerUp(page);
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(rect.x - 1, rect.y - 1);
          await page.mouse.up();
          await awaitPromise(clickHandle);

          await page.waitForSelector(getEditorSelector(0));
          const usedColor = await page.evaluate(() => {
            const highlight = document.querySelector(
              `.page[data-page-number = "1"] .canvasWrapper > svg.highlight`
            );
            return highlight.getAttribute("fill");
          });

          expect(usedColor).withContext(`In ${browserName}`).toEqual("#AB0000");
        })
      );
    });
  });

  describe("Undo deletion popup has the expected behaviour", () => {
    let pages;
    const editorSelector = getEditorSelector(0);

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        {
          highlightEditorColors:
            "yellow=#FFFF00,green=#00FF00,blue=#0000FF,pink=#FF00FF,red=#FF0000",
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that deleting a highlight can be undone using the undo button", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);
          await page.waitForSelector("#editorUndoBar", { visible: true });

          await page.waitForSelector("#editorUndoBarUndoButton", {
            visible: true,
          });
          await page.click("#editorUndoBarUndoButton");
          await waitForSerialized(page, 1);
          await page.waitForSelector(editorSelector);
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#FFFF00"]`
          );
        })
      );
    });

    it("must check that the popup disappears when the undo button is clicked", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);
          await page.waitForSelector("#editorUndoBar", { visible: true });

          await page.waitForSelector("#editorUndoBarUndoButton", {
            visible: true,
          });
          await page.click("#editorUndoBarUndoButton");
          await page.waitForSelector("#editorUndoBar", { hidden: true });
        })
      );
    });

    it("must check that the popup disappears when the close button is clicked", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);
          await page.waitForSelector("#editorUndoBar", { visible: true });

          await page.waitForSelector("#editorUndoBarCloseButton", {
            visible: true,
          });
          await page.click("#editorUndoBarCloseButton");
          await page.waitForSelector("#editorUndoBar", { hidden: true });
        })
      );
    });

    it("must check that the popup disappears when a new annotation is created", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await page.waitForSelector("#editorUndoBar", { visible: true });

          // TODO: remove the timeout and try to figure out a way to ensure that
          // the previous operations are fully processed before creating a new
          // highlight.
          // eslint-disable-next-line no-restricted-syntax
          await waitForTimeout(100);

          await highlightSpan(page, 1, "Introduction");
          await page.waitForSelector("#editorUndoBar", { hidden: true });
        })
      );
    });

    it("must check that the popup disappears when the print dialog is opened", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);
          await page.waitForSelector("#editorUndoBar", { visible: true });

          await page.evaluate(() => window.print());
          await page.waitForSelector("#editorUndoBar", { hidden: true });
        })
      );
    });

    it("must check that the popup disappears when the user clicks on the print button", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);
          await page.waitForSelector("#editorUndoBar", { visible: true });

          await page.click("#printButton");
          await page.waitForSelector("#editorUndoBar", { hidden: true });
        })
      );
    });

    it("must check that the popup disappears when the save dialog is opened", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);
          await page.waitForSelector("#editorUndoBar", { visible: true });

          await kbSave(page);
          await page.waitForSelector("#editorUndoBar", { hidden: true });
        })
      );
    });

    it("must check that the popup disappears when an option from the secondaryToolbar is used", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);
          await page.waitForSelector("#editorUndoBar", { visible: true });

          await page.click("#secondaryToolbarToggleButton");
          await page.click("#lastPage");
          await page.waitForSelector("#editorUndoBar", { hidden: true });
        })
      );
    });

    it("must check that the popup disappears when highlight mode is disabled", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);
          await page.waitForSelector("#editorUndoBar", { visible: true });

          await switchToHighlight(page, /* disable */ true);
          await page.waitForSelector("#editorUndoBar", { hidden: true });
        })
      );
    });

    it("must check that the popup disappears when a PDF is drag-and-dropped", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);
          await page.waitForSelector("#editorUndoBar", { visible: true });
          const pdfPath = path.join(__dirname, "../pdfs/basicapi.pdf");
          const pdfData = fs.readFileSync(pdfPath).toString("base64");
          const dataTransfer = await page.evaluateHandle(data => {
            const transfer = new DataTransfer();
            const view = Uint8Array.fromBase64(data);
            const file = new File([view], "basicapi.pdf", {
              type: "application/pdf",
            });
            transfer.items.add(file);
            return transfer;
          }, pdfData);

          const dropSelector = "#viewer";
          await page.evaluate(
            (transfer, selector) => {
              const dropTarget = document.querySelector(selector);
              const event = new DragEvent("dragstart", {
                dataTransfer: transfer,
              });
              dropTarget.dispatchEvent(event);
            },
            dataTransfer,
            dropSelector
          );

          await page.evaluate(
            (transfer, selector) => {
              const dropTarget = document.querySelector(selector);
              const event = new DragEvent("drop", {
                dataTransfer: transfer,
                bubbles: true,
              });
              dropTarget.dispatchEvent(event);
            },
            dataTransfer,
            dropSelector
          );
          await page.waitForSelector("#editorUndoBar", { hidden: true });
        })
      );
    });

    it("must check that the undo deletion popup displays the correct message", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);

          await page.waitForFunction(() => {
            const messageElement = document.querySelector(
              "#editorUndoBarMessage"
            );
            return messageElement && messageElement.textContent.trim() !== "";
          });

          const message = await page.waitForSelector("#editorUndoBarMessage");
          const messageText = await page.evaluate(
            el => el.textContent,
            message
          );
          expect(messageText).toContain("Highlight removed");
        })
      );
    });

    it("must display correct message for multiple highlights", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await highlightSpan(page, 1, "Languages");

          await selectAll(page);
          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);

          await page.waitForFunction(() => {
            const messageElement = document.querySelector(
              "#editorUndoBarMessage"
            );
            return messageElement && messageElement.textContent.trim() !== "";
          });

          const message = await page.waitForSelector("#editorUndoBarMessage");
          const messageText = await page.evaluate(
            el => el.textContent,
            message
          );

          // Cleans the message text by removing all non-ASCII characters.
          // It eliminates any invisible characters such as directional marks
          // that interfere with string comparisons
          const cleanMessage = messageText.replaceAll(/\P{ASCII}/gu, "");
          expect(cleanMessage).toContain(`2 annotations removed`);
        })
      );
    });

    it("must work properly when selecting undo by keyboard", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);
          await page.waitForSelector("#editorUndoBar", { visible: true });

          await page.waitForSelector("#editorUndoBarUndoButton", {
            visible: true,
          });
          await page.focus("#editorUndoBarUndoButton"); // we have to simulate focus like this to avoid the wait
          await page.keyboard.press("Enter");
          await waitForSerialized(page, 1);
          await page.waitForSelector(editorSelector);
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#FFFF00"]`
          );

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);
          await page.waitForSelector("#editorUndoBar", { visible: true });

          await page.waitForSelector("#editorUndoBarUndoButton", {
            visible: true,
          });
          await page.focus("#editorUndoBarUndoButton"); // we have to simulate focus like this to avoid the wait
          await page.keyboard.press(" ");
          await waitForSerialized(page, 1);
          await page.waitForSelector(editorSelector);
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlight[fill = "#FFFF00"]`
          );
        })
      );
    });

    it("must dismiss itself when user presses space/enter key and undo key isn't focused", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await waitForSerialized(page, 1);

          await page.waitForSelector(`${editorSelector} button.deleteButton`);
          await page.click(`${editorSelector} button.deleteButton`);
          await waitForSerialized(page, 0);
          await page.waitForSelector("#editorUndoBar", { visible: true });

          await page.focus("#editorUndoBar");
          await page.keyboard.press("Enter");
          await page.waitForSelector("#editorUndoBar", { hidden: true });
        })
      );
    });
  });

  describe("Highlight mustn't trigger a scroll when edited", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("issue18911.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that there is no scroll because of focus", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          const page4Selector = ".page[data-page-number = '4']";
          const page5Selector = ".page[data-page-number = '5']";
          await scrollIntoView(page, page4Selector);
          await page.waitForSelector(`${page5Selector} .annotationEditorLayer`);

          // When moving to page 4, the highlight editor mustn't be focused (it
          // was causing a scroll to page 5).
          // So here we're waiting a bit and checking that the page is still 4.
          // eslint-disable-next-line no-restricted-syntax
          await waitForTimeout(100);

          // Get the length of the intersection between two ranges.
          const inter = ([a, b], [c, d]) =>
            d < a || b < c ? 0 : Math.min(b, d) - Math.max(a, c);

          const page4Rect = await getRect(page, page4Selector);
          const page5Rect = await getRect(page, page5Selector);
          const viewportRect = await getRect(page, "#viewerContainer");
          const viewportRange = [
            viewportRect.y,
            viewportRect.y + viewportRect.height,
          ];

          const interPage4 = inter(
            [page4Rect.y, page4Rect.y + page4Rect.height],
            viewportRange
          );
          const interPage5 = inter(
            [page5Rect.y, page5Rect.y + page5Rect.height],
            viewportRange
          );
          expect(interPage4)
            .withContext(`In ${browserName}`)
            .toBeGreaterThan(0.5 * interPage5);
        })
      );
    });
  });

  describe("Highlight must be rotated when existing in the pdf", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("issue19424.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that there is no scroll because of focus", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await page.evaluate(() => {
            window.PDFViewerApplication.rotatePages(90);
          });
          await page.waitForSelector(
            ".annotationEditorLayer[data-main-rotation='90']"
          );
          await switchToHighlight(page);

          await page.waitForSelector(
            ".canvasWrapper svg[data-main-rotation='90']"
          );
        })
      );
    });
  });

  describe("Highlight params toolbar closes after color select", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000,blue=#0000AB" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must close the params toolbar while keeping highlight mode active", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);
          await page.waitForSelector(
            "#editorHighlightParamsToolbar:not(.hidden)"
          );

          await page.click(
            "#editorHighlightColorPicker button[title = 'Blue']"
          );

          await page.waitForSelector("#editorHighlightParamsToolbar.hidden");
          expect(
            await page.$eval("#editorHighlightButton", el =>
              el.classList.contains("toggled")
            )
          )
            .withContext(`In ${browserName}`)
            .toBeTrue();
          expect(
            await page.$eval("#editorHighlightButton", el =>
              el.getAttribute("aria-expanded")
            )
          )
            .withContext(`In ${browserName}`)
            .toEqual("false");
          await page.waitForSelector(".annotationEditorLayer.highlightEditing");

          // Mode stays active — further highlighting still works.
          await highlightSpan(page, 1, "Abstract");
          await page.waitForSelector(
            `.page[data-page-number = "1"] .canvasWrapper > svg.highlight[fill = "#0000AB"]`
          );
        })
      );
    });
  });

  describe("Underline params toolbar closes after color or style select", () => {
    let pages;
    const switchToUnderline = switchToEditor.bind(null, "Underline");

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        {
          highlightEditorColors: "red=#AB0000,blue=#0000AB",
          underlineEditorColors: "red=#AB0000,blue=#0000AB",
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must close the params toolbar after color select while keeping underline mode", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToUnderline(page);
          await page.waitForSelector(
            "#editorUnderlineParamsToolbar:not(.hidden)"
          );

          await page.click(
            "#editorUnderlineColorPicker button[title = 'Blue']"
          );

          await page.waitForSelector("#editorUnderlineParamsToolbar.hidden");
          expect(
            await page.$eval("#editorUnderlineButton", el =>
              el.classList.contains("toggled")
            )
          )
            .withContext(`In ${browserName}`)
            .toBeTrue();
          await page.waitForSelector(".annotationEditorLayer.underlineEditing");
        })
      );
    });

    it("must close the params toolbar after style select while keeping underline mode", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToUnderline(page);
          await page.waitForSelector(
            "#editorUnderlineParamsToolbar:not(.hidden)"
          );

          await page.click("#editorUnderlineStyleWavy");

          await page.waitForSelector("#editorUnderlineParamsToolbar.hidden");
          expect(
            await page.$eval("#editorUnderlineButton", el =>
              el.classList.contains("toggled")
            )
          )
            .withContext(`In ${browserName}`)
            .toBeTrue();
          await page.waitForSelector(".annotationEditorLayer.underlineEditing");
        })
      );
    });
  });

  describe("Underline style persists for the next mark", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        {
          highlightEditorColors: "red=#AB0000,blue=#0000AB",
          underlineEditorColors: "red=#AB0000,blue=#0000AB",
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must apply top-menu wavy to the selected underline and the next one", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          // Activate via keyboard so the params doorhanger stays collapsed
          // (US1: u → mark → top-menu style). A toolbar click while the
          // doorhanger is already open would leave underline mode.
          await page.keyboard.press("u");
          await page.waitForSelector(".annotationEditorLayer.underlineEditing");

          // First mark (default solid).
          await highlightSpan(page, 1, "Abstract");
          await page.waitForSelector(`${getEditorSelector(0)}.underlineEditor`);
          await waitForSerialized(page, 1);
          expect((await getSerialized(page))[0].style)
            .withContext(`In ${browserName}`)
            .toEqual("solid");

          // Style change with selection: update selected + set default.
          await page.click("#editorUnderlineButton");
          await page.waitForSelector(
            "#editorUnderlineParamsToolbar:not(.hidden)"
          );
          await page.click("#editorUnderlineStyleWavy");
          await page.waitForSelector("#editorUnderlineParamsToolbar.hidden");

          await waitForSerialized(page, 1);
          expect((await getSerialized(page))[0].style)
            .withContext(`In ${browserName}`)
            .toEqual("wavy");

          // Second mark must reuse wavy without another style click.
          await highlightSpan(page, 1, "Introduction");
          await page.waitForSelector(`${getEditorSelector(1)}.underlineEditor`);
          await waitForSerialized(page, 2);
          const serialized = await getSerialized(page);
          expect(serialized.length).withContext(`In ${browserName}`).toEqual(2);
          expect(serialized.every(e => e.style === "wavy"))
            .withContext(`In ${browserName}`)
            .toBeTrue();
        })
      );
    });
  });

  describe("Underline uses its own opaque color palette", () => {
    let pages;
    const switchToUnderline = switchToEditor.bind(null, "Underline");

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        {
          highlightEditorColors: "yellow=#FFFF98,pink=#FFCBE6",
          underlineEditorColors: "yellow=#D4A000,pink=#D81B60",
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must use underlineEditorColors for yellow stroke, not highlight yellow", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToUnderline(page);
          await page.waitForSelector(
            "#editorUnderlineParamsToolbar:not(.hidden)"
          );

          const underlineYellow = await page.$eval(
            "#editorUnderlineColorPicker button[title = 'Yellow'] .swatch",
            el => getComputedStyle(el).backgroundColor
          );
          expect(underlineYellow)
            .withContext(`In ${browserName}`)
            .toEqual("rgb(212, 160, 0)");

          await page.click(
            "#editorUnderlineColorPicker button[title = 'Yellow']"
          );
          await page.waitForSelector("#editorUnderlineParamsToolbar.hidden");
          await page.waitForSelector(".annotationEditorLayer.underlineEditing");

          await highlightSpan(page, 1, "Abstract");
          await page.waitForSelector(`${getEditorSelector(0)}.underlineEditor`);
          await page.waitForSelector(
            `.page[data-page-number = "1"] .canvasWrapper > svg.underline[stroke = "#D4A000"]`
          );

          // Highlight palette must remain the pale yellow.
          await switchToHighlight(page);
          await page.waitForSelector(
            "#editorHighlightParamsToolbar:not(.hidden)"
          );
          const highlightYellow = await page.$eval(
            "#editorHighlightColorPicker button[title = 'Yellow'] .swatch",
            el => getComputedStyle(el).backgroundColor
          );
          expect(highlightYellow)
            .withContext(`In ${browserName}`)
            .toEqual("rgb(255, 255, 152)");
        })
      );
    });
  });

  describe("Highlight must change their color when selected", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000,blue=#0000AB" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that the color is correctly updated", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          const highlightSelector = `.page[data-page-number = "1"] .canvasWrapper > svg.highlight`;
          await page.waitForSelector(`${highlightSelector}[fill = "#AB0000"]`);

          await page.click(
            "#editorHighlightColorPicker button[title = 'Blue']"
          );

          await page.waitForSelector(`${highlightSelector}[fill = "#0000AB"]`);
        })
      );
    });
  });

  describe("Highlight color in HCM", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        {
          highlightEditorColors: "red=#AB0000,red_HCM=#00AB00",
          forcePageColors: true,
          pageColorsForeground: "#74ffd0",
          pageColorsBackground: "#392a4f",
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must highlight with red color", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Abstract");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlightOutline.selected`
          );

          await page.waitForSelector(
            `.page[data-page-number = "1"] .canvasWrapper > svg.highlight[fill = "#00AB00"]`
          );
          await waitForSerialized(page, 1);
          const serialized = await getSerialized(page);
          expect(serialized[0].color)
            .withContext(`In ${browserName}`)
            .toEqual([0xab, 0x00, 0x00]);
        })
      );
    });
  });

  describe("Highlight editor color picker with an extended palette", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait("tracemonkey.pdf", ".annotationEditorLayer");
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must display the additional preset colors and a custom color input", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);
          await page.waitForSelector("#editorHighlightColorPicker");

          const titles = await page.evaluate(() =>
            Array.from(
              document.querySelectorAll(
                "#editorHighlightColorPicker button[data-color]"
              )
            ).map(button => button.title)
          );
          for (const name of ["Orange", "Purple", "Cyan", "Gray", "Brown"]) {
            expect(titles).withContext(`In ${browserName}`).toContain(name);
          }

          await page.waitForSelector(
            "#editorHighlightColorPicker .customColorRow input.basicColorPicker"
          );
        })
      );
    });
  });

  describe("Highlight editor must support a free-form custom color", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must highlight with a color chosen from the custom color input", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          const customInputSelector =
            "#editorHighlightColorPicker .customColorRow input.basicColorPicker";
          await page.waitForSelector(customInputSelector);
          await page.locator(customInputSelector).fill("#1a2b3c");

          const selectedColor = await page.evaluate(() => {
            const selected = document.querySelector(
              '#editorHighlightColorPicker button[data-color][aria-selected="true"]'
            );
            return selected?.getAttribute("data-color");
          });
          expect(selectedColor)
            .withContext(`In ${browserName}`)
            .toEqual("#1A2B3C");

          await highlightSpan(page, 1, "Abstract");
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlightOutline.selected`
          );

          const usedColor = await page.evaluate(() => {
            const highlight = document.querySelector(
              `.page[data-page-number = "1"] .canvasWrapper > svg.highlight`
            );
            return highlight.getAttribute("fill");
          });

          expect(usedColor).withContext(`In ${browserName}`).toEqual("#1A2B3C");
        })
      );
    });
  });

  describe("Highlight editor must reproduce a previously used custom color", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must reuse the custom color of a reselected highlight for new highlights", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          const customInputSelector =
            "#editorHighlightColorPicker .customColorRow input.basicColorPicker";
          await page.waitForSelector(customInputSelector);
          await page.locator(customInputSelector).fill("#1a2b3c");

          await highlightSpan(page, 1, "Abstract");
          const editorSelector0 = getEditorSelector(0);
          await page.waitForSelector(editorSelector0);

          // Committing the custom color closes the params toolbar; re-open it
          // (toggle tool off/on) before picking another palette color.
          await switchToHighlight(page, /* disable */ true);
          await switchToHighlight(page);
          await page.click("#editorHighlightColorPicker button[title = 'Red']");
          await highlightSpan(page, 1, "Languages");
          const editorSelector1 = getEditorSelector(1);
          await page.waitForSelector(editorSelector1);

          await waitForSerialized(page, 2);
          let serialized = await getSerialized(page);
          expect(serialized[0].color)
            .withContext(`In ${browserName}`)
            .toEqual([0x1a, 0x2b, 0x3c]);
          expect(serialized[1].color)
            .withContext(`In ${browserName}`)
            .toEqual([0xab, 0x00, 0x00]);

          // Reselecting the first (custom-colored) highlight must make its
          // color the default one again, so that a brand new highlight
          // reuses it without having to open the color picker.
          await unselectEditor(page, editorSelector1);
          await selectEditor(page, editorSelector0);
          await unselectEditor(page, editorSelector0);

          await highlightSpan(page, 1, "Introduction");
          await waitForSerialized(page, 3);
          serialized = await getSerialized(page);

          expect(serialized[2].color)
            .withContext(`In ${browserName}`)
            .toEqual([0x1a, 0x2b, 0x3c]);
        })
      );
    });
  });

  describe("Highlight the selection but without a mouse or a keyboard", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must highlight with red color", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await page.evaluate(() => {
            // Take the first span which contains "Trace-based Just-in-Time..."
            const root = document.querySelector(
              ".page[data-page-number='1'] > .textLayer"
            );
            const iter = document.createNodeIterator(
              root,
              NodeFilter.SHOW_TEXT
            );
            const textnode = iter.nextNode();
            const selection = document.getSelection();
            const range = document.createRange();
            range.selectNodeContents(textnode);
            selection.removeAllRanges();
            selection.addRange(range);
          });

          await page.waitForSelector(`${getEditorSelector(0)}`);
          await page.waitForSelector(
            `.page[data-page-number = "1"] svg.highlightOutline.selected`
          );

          const usedColor = await page.evaluate(() => {
            const highlight = document.querySelector(
              `.page[data-page-number = "1"] .canvasWrapper > svg.highlight`
            );
            return highlight.getAttribute("fill");
          });

          expect(usedColor).withContext(`In ${browserName}`).toEqual("#AB0000");
        })
      );
    });
  });

  describe("Highlight (edit existing and scroll)", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "highlights.pdf",
        ".annotationEditorLayer",
        null,
        null,
        {
          highlightEditorColors:
            "yellow=#FFFF00,green=#00FF00,blue=#0000FF,pink=#FF00FF,red=#FF0102",
        }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that no extra annotations are added while in editing mode", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          const editorSelector = getEditorSelector(7);
          await page.waitForSelector(editorSelector);

          const oneToOne = Array.from(new Array(13).keys(), n => n + 2).concat(
            Array.from(new Array(13).keys(), n => 13 - n)
          );
          for (const pageNumber of oneToOne) {
            await scrollIntoView(
              page,
              `.page[data-page-number = "${pageNumber}"]`
            );
          }

          await page.waitForSelector(editorSelector);

          const count = await page.evaluate(
            () =>
              document.querySelectorAll(
                `.page[data-page-number = "1"] .annotationEditorLayer .highlightEditor`
              ).length
          );
          expect(count).withContext(`In ${browserName}`).toEqual(8);
        })
      );
    });

    it("must check that no extra annotations are added while in reading mode", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          const editorSelector = getEditorSelector(7);
          await page.waitForSelector(editorSelector);

          const oneToThirteen = Array.from(new Array(13).keys(), n => n + 2);
          const thirteenToOne = Array.from(new Array(13).keys(), n => 13 - n);
          for (const pageNumber of oneToThirteen) {
            await scrollIntoView(
              page,
              `.page[data-page-number = "${pageNumber}"]`
            );
          }

          await switchToHighlight(page, /* disable */ true);

          for (const pageNumber of thirteenToOne) {
            await scrollIntoView(
              page,
              `.page[data-page-number = "${pageNumber}"]`
            );
          }

          await page.waitForSelector(
            `.page[data-page-number = "1"] .annotationEditorLayer.disabled`
          );

          await page.waitForFunction(
            () =>
              document.querySelectorAll(
                `.page[data-page-number = "1"] .annotationEditorLayer .highlightEditor`
              ).length === 0
          );
        })
      );
    });
  });

  describe("An ink between two highlights and focus", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        ".annotationEditorLayer",
        null,
        null,
        { highlightEditorColors: "red=#AB0000" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must check that focus move from an editor to an other", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);

          await highlightSpan(page, 1, "Languages");
          const editorSelector0 = getEditorSelector(0);

          await highlightSpan(page, 1, "Abstract");
          const editorSelector1 = getEditorSelector(1);

          await switchToEditor("Ink", page);

          const rect = await getSpanRectFromText(
            page,
            1,
            "University of California, Irvine"
          );

          const clickHandle = await waitForPointerUp(page);
          await page.mouse.move(rect.x, rect.y);
          await page.mouse.down();
          await page.mouse.move(rect.x + 50, rect.y + 50);
          await page.mouse.up();
          await awaitPromise(clickHandle);

          await page.keyboard.press("Escape");
          await page.waitForSelector(
            ".inkEditor.selectedEditor.draggable.disabled"
          );

          await selectEditor(page, editorSelector0);
          for (let i = 0; i < 6; i++) {
            await page.keyboard.press("Tab", { delay: 100 });
          }
          await waitForSelectedEditor(page, editorSelector1);
        })
      );
    });
  });

  describe("All editors must be focusable", () => {
    describe("bug1992868.pdf", () => {
      let pages;

      beforeEach(async () => {
        pages = await loadAndWait(
          "bug1992868.pdf",
          getAnnotationSelector("999R"),
          "page-fit"
        );
      });

      afterEach(async () => {
        await closePages(pages);
      });

      it("must check that the freetext annotation can be reached", async () => {
        await Promise.all(
          pages.map(async ([browserName, page]) => {
            const modeChangedHandle = await waitForAnnotationModeChanged(page);
            await page.click(getAnnotationSelector("997R"), { count: 2 });
            await awaitPromise(modeChangedHandle);
            await page.waitForSelector("#highlightParamsToolbarContainer");

            const editorSelector = getEditorSelector(0);
            await page.waitForSelector(editorSelector);
            await page.focus(editorSelector);
            await waitForSelectedEditor(page, editorSelector);

            for (let i = 0; i < 4; i++) {
              await page.keyboard.press("Tab", { delay: 100 });
            }
            await waitForSelectedEditor(page, getEditorSelector(1));
          })
        );
      });
    });
  });

  describe("Shortcut h/u for highlight and underline tools", () => {
    let pages;

    beforeEach(async () => {
      pages = await loadAndWait(
        "tracemonkey.pdf",
        `.page[data-page-number = "1"] .endOfContent`,
        null,
        null,
        { highlightEditorColors: "red=#AB0000,green=#00AB00" }
      );
    });

    afterEach(async () => {
      await closePages(pages);
    });

    it("must highlight the selection with the last used color", async () => {
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          await switchToHighlight(page);
          await page.evaluate(() => {
            window.PDFViewerApplication.eventBus.dispatch(
              "switchannotationeditorparams",
              {
                source: null,
                type: window.pdfjsLib.AnnotationEditorParamsType
                  .HIGHLIGHT_COLOR,
                value: "#00AB00",
              }
            );
          });
          // Leave highlight mode so 'h' must switch modes itself.
          await switchToHighlight(page, /* disable = */ true);

          const rect = await getSpanRectFromText(page, 1, "Abstract");
          const x = rect.x + rect.width / 2;
          const y = rect.y + rect.height / 2;
          await page.mouse.click(x, y, { count: 2, delay: 100 });
          await page.waitForFunction(
            () => !document.getSelection().isCollapsed
          );

          await page.keyboard.press("h");
          await page.waitForSelector(getEditorSelector(0));

          const usedColor = await page.evaluate(() => {
            const highlight = document.querySelector(
              `.page[data-page-number = "1"] .canvasWrapper > svg.highlight`
            );
            return highlight.getAttribute("fill");
          });
          expect(usedColor).withContext(`In ${browserName}`).toEqual("#00AB00");

          // Without a selection, 'h' activates the Highlight tool (not Hand)
          // without opening the params doorhanger.
          await page.mouse.click(rect.x + rect.width + 10, y);
          await page.waitForFunction(() => document.getSelection().isCollapsed);
          await switchToHighlight(page, /* disable = */ true);
          await page.keyboard.press("h");
          await page.waitForSelector(".annotationEditorLayer.highlightEditing");
          expect(
            await page.$eval("#editorHighlightButton", el =>
              el.classList.contains("toggled")
            )
          )
            .withContext(`In ${browserName}`)
            .toBeTrue();
          expect(
            await page.$eval("#editorHighlightParamsToolbar", el =>
              el.classList.contains("hidden")
            )
          )
            .withContext(`In ${browserName}`)
            .toBeTrue();
          expect(
            await page.$eval("#editorHighlightButton", el =>
              el.getAttribute("aria-expanded")
            )
          )
            .withContext(`In ${browserName}`)
            .toEqual("false");

          // Explicit toolbar click expands the params doorhanger.
          await page.click("#editorHighlightButton");
          await page.waitForSelector(
            "#editorHighlightParamsToolbar:not(.hidden)"
          );
          expect(
            await page.$eval("#editorHighlightButton", el =>
              el.classList.contains("toggled")
            )
          )
            .withContext(`In ${browserName}`)
            .toBeTrue();
          await page.waitForSelector(".annotationEditorLayer.highlightEditing");
        })
      );
    });

    it("must activate underline mode and underline a selection with u", async () => {
      const switchToUnderline = switchToEditor.bind(null, "Underline");
      await Promise.all(
        pages.map(async ([browserName, page]) => {
          const rect = await getSpanRectFromText(page, 1, "Abstract");
          const x = rect.x + rect.width / 2;
          const y = rect.y + rect.height / 2;

          // Without a selection, 'u' activates the Underline tool silently.
          await page.keyboard.press("u");
          await page.waitForSelector(".annotationEditorLayer.underlineEditing");
          expect(
            await page.$eval("#editorUnderlineButton", el =>
              el.classList.contains("toggled")
            )
          )
            .withContext(`In ${browserName}`)
            .toBeTrue();
          expect(
            await page.$eval("#editorUnderlineParamsToolbar", el =>
              el.classList.contains("hidden")
            )
          )
            .withContext(`In ${browserName}`)
            .toBeTrue();
          expect(
            await page.$eval("#editorUnderlineButton", el =>
              el.getAttribute("aria-expanded")
            )
          )
            .withContext(`In ${browserName}`)
            .toEqual("false");

          // Explicit toolbar click expands the params doorhanger.
          await page.click("#editorUnderlineButton");
          await page.waitForSelector(
            "#editorUnderlineParamsToolbar:not(.hidden)"
          );

          await switchToUnderline(page, /* disable = */ true);

          await page.mouse.click(x, y, { count: 2, delay: 100 });
          await page.waitForFunction(
            () => !document.getSelection().isCollapsed
          );

          await page.keyboard.press("u");
          await page.waitForSelector(getEditorSelector(0));
          const hasUnderline = await page.evaluate(
            sel => !!document.querySelector(sel),
            `${getEditorSelector(0)}.underlineEditor`
          );
          expect(hasUnderline).withContext(`In ${browserName}`).toBeTrue();
        })
      );
    });
  });
});
