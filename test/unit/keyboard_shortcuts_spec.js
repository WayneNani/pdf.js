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

import {
  bindingFromEvent,
  DEFAULT_SHORTCUTS,
  formatBindingLabel,
  matchShortcut,
  normalizeBinding,
  parseShortcutsPreference,
  resolveHighlightColor,
  serializeShortcutsPreference,
  validateBinding,
} from "../../web/keyboard_shortcuts.js";

describe("keyboard_shortcuts", function () {
  describe("normalizeBinding", function () {
    it("normalizes modifier order and case", function () {
      expect(normalizeBinding("Shift+Ctrl+H")).toEqual("ctrl+shift+h");
      expect(normalizeBinding(" space ")).toEqual("space");
      expect(normalizeBinding("")).toEqual("");
    });
  });

  describe("parse/serialize preference", function () {
    it("returns defaults for empty preference", function () {
      const parsed = parseShortcutsPreference("{}");
      expect(parsed.highlight).toEqual("h");
      expect(parsed.underline).toEqual("u");
      expect(parsed["highlight.yellow"]).toEqual("");
    });

    it("applies overrides and ignores unknown keys", function () {
      const parsed = parseShortcutsPreference(
        JSON.stringify({
          highlight: "b",
          unknown: "x",
          "highlight.yellow": "1",
        })
      );
      expect(parsed.highlight).toEqual("b");
      expect(parsed["highlight.yellow"]).toEqual("1");
      expect(parsed.unknown).toBeUndefined();
    });

    it("serializes only non-default bindings", function () {
      const shortcuts = { ...DEFAULT_SHORTCUTS, highlight: "b" };
      expect(serializeShortcutsPreference(shortcuts)).toEqual(
        JSON.stringify({ highlight: "b" })
      );
    });
  });

  describe("validateBinding", function () {
    it("rejects collisions between actions", function () {
      const shortcuts = { ...DEFAULT_SHORTCUTS };
      const result = validateBinding(shortcuts, "underline", "h");
      expect(result.ok).toBeFalse();
      expect(result.reason).toEqual("collision");
      expect(result.conflictActionId).toEqual("highlight");
    });

    it("rejects reserved navigation keys", function () {
      const shortcuts = { ...DEFAULT_SHORTCUTS };
      const result = validateBinding(shortcuts, "highlight", "j");
      expect(result.ok).toBeFalse();
      expect(result.reason).toEqual("reserved");
    });

    it("allows clearing a binding", function () {
      const shortcuts = { ...DEFAULT_SHORTCUTS };
      expect(validateBinding(shortcuts, "highlight", "").ok).toBeTrue();
    });

    it("allows binding an unused key", function () {
      const shortcuts = { ...DEFAULT_SHORTCUTS, highlight: "" };
      expect(validateBinding(shortcuts, "highlight", "b").ok).toBeTrue();
    });
  });

  describe("matchShortcut", function () {
    it("matches default highlight on h", function () {
      const shortcuts = parseShortcutsPreference("{}");
      const evt = {
        key: "h",
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      };
      expect(matchShortcut(shortcuts, 0, evt)).toEqual("highlight");
    });

    it("matches a custom color binding", function () {
      const shortcuts = parseShortcutsPreference(
        JSON.stringify({ "highlight.yellow": "1" })
      );
      const evt = {
        key: "1",
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      };
      expect(matchShortcut(shortcuts, 0, evt)).toEqual("highlight.yellow");
    });

    it("matches modifier bindings", function () {
      const shortcuts = parseShortcutsPreference(
        JSON.stringify({ "underline.wavy": "shift+w" })
      );
      const evt = {
        key: "w",
        ctrlKey: false,
        altKey: false,
        shiftKey: true,
        metaKey: false,
      };
      expect(matchShortcut(shortcuts, /* SHIFT */ 4, evt)).toEqual(
        "underline.wavy"
      );
    });
  });

  describe("helpers", function () {
    it("formats binding labels", function () {
      expect(formatBindingLabel("ctrl+shift+h")).toEqual("Ctrl+Shift+H");
      expect(formatBindingLabel("")).toEqual("");
    });

    it("builds a binding from an event", function () {
      expect(
        bindingFromEvent({
          key: "A",
          ctrlKey: true,
          altKey: false,
          shiftKey: true,
          metaKey: false,
        })
      ).toEqual("ctrl+shift+a");
    });

    it("resolves highlight colors from the preference string", function () {
      const colors = "yellow=#FFFF98,green=#53FFBC,yellow_HCM=#FFFFCC";
      expect(resolveHighlightColor("yellow", colors)).toEqual("#FFFF98");
      expect(resolveHighlightColor("missing", colors)).toBeNull();
    });
  });
});
