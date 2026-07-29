/* Copyright 2023 Mozilla Foundation
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
  AnnotationEditorParamsType,
  AnnotationEditorType,
  FeatureTest,
  shadow,
  Util,
} from "../../shared/util.js";
import { getRGBA, noContextMenu } from "../display_utils.js";
import { KeyboardManager } from "./tools.js";

/**
 * ColorPicker class provides a color picker for the annotation editor.
 * It displays a dropdown with some predefined colors and allows the user
 * to select a color for the annotation.
 */
class ColorPicker {
  #button = null;

  #buttonSwatch = null;

  #customColorInput = null;

  #defaultColor;

  #colorParamType;

  #dropdown = null;

  #dropdownWasFromKeyboard = false;

  #isMainColorPicker = false;

  #editor = null;

  #eventBus;

  #openDropdownAC = null;

  #uiManager = null;

  static #l10nColor = null;

  static get _keyboardManager() {
    return shadow(
      this,
      "_keyboardManager",
      new KeyboardManager([
        [["Escape"], ColorPicker.prototype._hideDropdownFromKeyboard],
        [["Space"], ColorPicker.prototype._colorSelectFromKeyboard],
        [["ArrowDown", "ArrowRight"], ColorPicker.prototype._moveToNext],
        [["ArrowUp", "ArrowLeft"], ColorPicker.prototype._moveToPrevious],
        [["Home"], ColorPicker.prototype._moveToBeginning],
        [["End"], ColorPicker.prototype._moveToEnd],
      ])
    );
  }

  constructor({ editor = null, uiManager = null, colorParamType = null }) {
    if (editor) {
      this.#isMainColorPicker = false;
      this.#editor = editor;
    } else {
      this.#isMainColorPicker = true;
    }
    this.#uiManager = editor?._uiManager || uiManager;
    this.#eventBus = this.#uiManager._eventBus;
    this.#defaultColor =
      editor?.color?.toUpperCase() ||
      this.#uiManager?.highlightColors.values().next().value ||
      "#FFFF98";
    this.#colorParamType =
      colorParamType ||
      (editor?.mode === AnnotationEditorType.UNDERLINE
        ? AnnotationEditorParamsType.UNDERLINE_COLOR
        : AnnotationEditorParamsType.HIGHLIGHT_COLOR);

    ColorPicker.#l10nColor ||= Object.freeze({
      blue: "pdfjs-editor-colorpicker-blue",
      green: "pdfjs-editor-colorpicker-green",
      pink: "pdfjs-editor-colorpicker-pink",
      red: "pdfjs-editor-colorpicker-red",
      yellow: "pdfjs-editor-colorpicker-yellow",
      orange: "pdfjs-editor-colorpicker-orange",
      purple: "pdfjs-editor-colorpicker-purple",
      cyan: "pdfjs-editor-colorpicker-cyan",
      gray: "pdfjs-editor-colorpicker-gray",
      brown: "pdfjs-editor-colorpicker-brown",
    });
  }

  renderButton() {
    const button = (this.#button = document.createElement("button"));
    button.className = "colorPicker";
    button.tabIndex = "0";
    button.setAttribute("data-l10n-id", "pdfjs-editor-colorpicker-button");
    button.ariaHasPopup = "true";
    if (this.#editor) {
      button.ariaControls = `${this.#editor.id}_colorpicker_dropdown`;
    }
    const signal = this.#uiManager._signal;
    button.addEventListener("click", this.#openDropdown.bind(this), { signal });
    button.addEventListener("keydown", this.#keyDown.bind(this), { signal });
    const swatch = (this.#buttonSwatch = document.createElement("span"));
    swatch.className = "swatch";
    swatch.ariaHidden = "true";
    swatch.style.backgroundColor = this.#defaultColor;
    button.append(swatch);
    return button;
  }

  renderMainDropdown(labelledBy = "highlightColorPickerLabel") {
    const dropdown = (this.#dropdown = this.#getDropdownRoot());
    dropdown.ariaOrientation = "horizontal";
    dropdown.ariaLabelledBy = labelledBy;
    this.#refreshRecentColors();

    return dropdown;
  }

  #getDropdownRoot() {
    const div = document.createElement("div");
    const signal = this.#uiManager._signal;
    div.addEventListener("contextmenu", noContextMenu, { signal });
    div.className = "dropdown";
    div.role = "listbox";
    div.ariaMultiSelectable = "false";
    div.ariaOrientation = "vertical";
    div.setAttribute("data-l10n-id", "pdfjs-editor-colorpicker-dropdown");
    if (this.#editor) {
      div.id = `${this.#editor.id}_colorpicker_dropdown`;
    }
    for (const [name, color] of this.#uiManager.highlightColors) {
      div.append(this.#createColorButton(name, color, signal));
    }
    this.#addCustomColorInput(div, signal);

    div.addEventListener("keydown", this.#keyDown.bind(this), { signal });

    return div;
  }

  #createColorButton(name, color, signal) {
    const button = document.createElement("button");
    button.tabIndex = "0";
    button.role = "option";
    button.setAttribute("data-color", color);
    button.title = name;
    const l10nId = ColorPicker.#l10nColor[name];
    if (l10nId) {
      button.setAttribute("data-l10n-id", l10nId);
    }
    const swatch = document.createElement("span");
    button.append(swatch);
    swatch.className = "swatch";
    swatch.style.backgroundColor = color;
    button.ariaSelected = color === this.#defaultColor;
    button.addEventListener("click", this.#colorSelect.bind(this, color), {
      signal,
    });
    return button;
  }

  /**
   * Render the colors that were recently picked via the free-form color
   * input, so that the same custom color can easily be reused. Only colors
   * that aren't already part of the predefined palette are shown here.
   */
  #refreshRecentColors() {
    if (!this.#dropdown) {
      return;
    }
    for (const button of this.#dropdown.querySelectorAll(".recentColor")) {
      button.remove();
    }
    const customColorRow = this.#dropdown.querySelector(".customColorRow");
    const signal = this.#uiManager._signal;
    for (const color of this.#uiManager.recentHighlightColors) {
      const button = this.#createColorButton(color, color, signal);
      button.classList.add("recentColor");
      this.#dropdown.insertBefore(button, customColorRow);
    }
  }

  #addCustomColorInput(div, signal) {
    const label = document.createElement("label");
    label.className = "customColorRow";
    const input = (this.#customColorInput = document.createElement("input"));
    input.type = "color";
    input.className = "basicColorPicker";
    input.tabIndex = 0;
    input.value = this.#defaultColor;
    input.setAttribute(
      "data-l10n-id",
      "pdfjs-editor-colorpicker-custom-color-input"
    );
    input.addEventListener(
      "input",
      event => {
        this.#colorSelect(input.value.toUpperCase(), event);
      },
      { signal }
    );
    input.addEventListener(
      "change",
      () => {
        const color = input.value.toUpperCase();
        this.#uiManager.addRecentHighlightColor(color);
        this.updateColor(color);
      },
      { signal }
    );
    label.append(input);
    div.append(label);
  }

  #colorSelect(color, event) {
    event.stopPropagation();
    this.#eventBus.dispatch("switchannotationeditorparams", {
      source: this,
      type: this.#colorParamType,
      value: color,
    });
    this.updateColor(color);
  }

  _colorSelectFromKeyboard(event) {
    if (event.target === this.#button) {
      this.#openDropdown(event);
      return;
    }
    const color = event.target.getAttribute("data-color");
    if (!color) {
      return;
    }
    this.#colorSelect(color, event);
  }

  _moveToNext(event) {
    if (!this.#isDropdownVisible) {
      this.#openDropdown(event);
      return;
    }
    if (event.target === this.#button) {
      this.#dropdown.firstElementChild?.focus();
      return;
    }
    event.target.nextSibling?.focus();
  }

  _moveToPrevious(event) {
    if (
      event.target === this.#dropdown?.firstElementChild ||
      event.target === this.#button
    ) {
      if (this.#isDropdownVisible) {
        this._hideDropdownFromKeyboard();
      }
      return;
    }
    if (!this.#isDropdownVisible) {
      this.#openDropdown(event);
    }
    event.target.previousSibling?.focus();
  }

  _moveToBeginning(event) {
    if (!this.#isDropdownVisible) {
      this.#openDropdown(event);
      return;
    }
    this.#dropdown.firstElementChild?.focus();
  }

  _moveToEnd(event) {
    if (!this.#isDropdownVisible) {
      this.#openDropdown(event);
      return;
    }
    // The custom-color <input> row isn't part of the arrow-key navigation,
    // so target the last actual color option instead of the last child.
    const buttons = this.#dropdown.querySelectorAll("button[data-color]");
    buttons.at(-1)?.focus();
  }

  #keyDown(event) {
    ColorPicker._keyboardManager.exec(this, event);
  }

  #openDropdown(event) {
    if (this.#isDropdownVisible) {
      this.hideDropdown();
      return;
    }
    this.#dropdownWasFromKeyboard = event.detail === 0;

    if (!this.#openDropdownAC) {
      this.#openDropdownAC = new AbortController();

      window.addEventListener("pointerdown", this.#pointerDown.bind(this), {
        signal: this.#uiManager.combinedSignal(this.#openDropdownAC),
      });
    }
    this.#button.ariaExpanded = "true";
    if (this.#dropdown) {
      this.#dropdown.classList.remove("hidden");
      return;
    }
    const root = (this.#dropdown = this.#getDropdownRoot());
    this.#button.append(root);
    this.#refreshRecentColors();
  }

  #pointerDown(event) {
    if (this.#dropdown?.contains(event.target)) {
      return;
    }
    this.hideDropdown();
  }

  hideDropdown() {
    this.#dropdown?.classList.add("hidden");
    this.#button.ariaExpanded = "false";
    this.#openDropdownAC?.abort();
    this.#openDropdownAC = null;
  }

  get #isDropdownVisible() {
    return this.#dropdown && !this.#dropdown.classList.contains("hidden");
  }

  _hideDropdownFromKeyboard() {
    if (this.#isMainColorPicker) {
      return;
    }
    if (!this.#isDropdownVisible) {
      // The user pressed Escape with no dropdown visible, so we must
      // unselect it.
      this.#editor?.unselect();
      return;
    }
    this.hideDropdown();
    this.#button.focus({
      preventScroll: true,
      focusVisible: this.#dropdownWasFromKeyboard,
    });
  }

  updateColor(color) {
    const upperColor = color.toUpperCase();
    if (this.#buttonSwatch) {
      this.#buttonSwatch.style.backgroundColor = upperColor;
    }
    if (this.#customColorInput) {
      this.#customColorInput.value = upperColor;
    }
    if (!this.#dropdown) {
      return;
    }

    this.#refreshRecentColors();
    for (const button of this.#dropdown.querySelectorAll(
      "button[data-color]"
    )) {
      button.ariaSelected = button.getAttribute("data-color") === upperColor;
    }
  }

  destroy() {
    this.#button?.remove();
    this.#button = null;
    this.#buttonSwatch = null;
    this.#customColorInput = null;
    this.#dropdown?.remove();
    this.#dropdown = null;
  }
}

/**
 * BasicColorPicker class provides a simple color picker.
 * It displays an input element (with type="color") that allows the user
 * to select a color for the annotation.
 */
class BasicColorPicker {
  #input = null;

  #hasAlpha = false;

  #editor = null;

  #uiManager = null;

  static #l10nColor = null;

  constructor(editor) {
    this.#editor = editor;
    this.#uiManager = editor._uiManager;

    BasicColorPicker.#l10nColor ||= Object.freeze({
      freetext: "pdfjs-editor-color-picker-free-text-input",
      ink: "pdfjs-editor-color-picker-ink-input",
    });
  }

  renderButton() {
    if (this.#input) {
      return this.#input;
    }
    const {
      editorType,
      colorType,
      colorAndOpacityType,
      opacityType,
      color,
      opacity,
    } = this.#editor;
    const hasAlpha = (this.#hasAlpha =
      FeatureTest.isAlphaColorInputSupported && opacityType !== undefined);
    const input = (this.#input = document.createElement("input"));
    input.type = "color";
    if (hasAlpha) {
      input.setAttribute("alpha", "");
      const alphaHex = Util.hexNums[Math.round((opacity ?? 1) * 255)];
      input.value = (color || "#000000") + alphaHex;
    } else {
      input.value = color || "#000000";
    }
    input.className = "basicColorPicker";
    input.tabIndex = 0;
    input.setAttribute("data-l10n-id", BasicColorPicker.#l10nColor[editorType]);
    input.addEventListener(
      "input",
      () => {
        if (hasAlpha) {
          const rgba = getRGBA(input.value);
          if (!rgba) {
            return;
          }
          const [r, g, b, op] = rgba;
          const hex = Util.makeHexColor(r, g, b);
          if (colorAndOpacityType !== undefined) {
            this.#uiManager.updateParams(colorAndOpacityType, {
              color: hex,
              opacity: op,
            });
          } else {
            this.#uiManager.updateParams(colorType, hex);
            this.#uiManager.updateParams(opacityType, op);
          }
        } else {
          this.#uiManager.updateParams(colorType, input.value);
        }
      },
      { signal: this.#uiManager._signal }
    );
    return input;
  }

  update(value) {
    if (!this.#input) {
      return;
    }
    if (this.#hasAlpha) {
      // Reconstruct #RRGGBBAA using the editor's current opacity.
      const alphaHex = Util.hexNums[Math.round(this.#editor.opacity * 255)];
      this.#input.value = value + alphaHex;
    } else {
      this.#input.value = value;
    }
  }

  updateOpacity(value) {
    if (!this.#input || !this.#hasAlpha) {
      return;
    }
    // Reconstruct #RRGGBBAA using the editor's current color.
    const alphaHex = Util.hexNums[Math.round(value * 255)];
    this.#input.value = this.#editor.color + alphaHex;
  }

  destroy() {
    this.#input?.remove();
    this.#input = null;
  }

  hideDropdown() {}
}

export { BasicColorPicker, ColorPicker };
