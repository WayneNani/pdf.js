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

/** @typedef {import("./event_utils.js").EventBus} EventBus */
/** @typedef {import("./overlay_manager.js").OverlayManager} OverlayManager */
/** @typedef {import("./l10n.js").L10n} L10n */

import {
  bindingFromEvent,
  DEFAULT_SHORTCUTS,
  formatBindingLabel,
  getActionMeta,
  getConfigurableActionIds,
  parseShortcutsPreference,
  serializeShortcutsPreference,
  validateBinding,
} from "./keyboard_shortcuts.js";
import { AppOptions } from "./app_options.js";

/**
 * @typedef {Object} KeyboardShortcutsDialogOptions
 * @property {HTMLDialogElement} dialog
 * @property {HTMLElement} list
 * @property {HTMLElement} status
 * @property {HTMLButtonElement} resetButton
 * @property {HTMLButtonElement} closeButton
 */

class KeyboardShortcutsDialog {
  #dialog;

  #list;

  #status;

  #overlayManager;

  #preferences;

  #l10n;

  #draft = null;

  #capturingActionId = null;

  #captureListening = false;

  #boundKeyDown = this.#onCaptureKeyDown.bind(this);

  /**
   * @param {KeyboardShortcutsDialogOptions} options
   * @param {OverlayManager} overlayManager
   * @param {EventBus} _eventBus
   * @param {import("./preferences.js").BasePreferences} preferences
   * @param {L10n} l10n
   */
  constructor(
    { dialog, list, status, resetButton, closeButton },
    overlayManager,
    _eventBus,
    preferences,
    l10n
  ) {
    this.#dialog = dialog;
    this.#list = list;
    this.#status = status;
    this.#overlayManager = overlayManager;
    this.#preferences = preferences;
    this.#l10n = l10n;

    closeButton.addEventListener("click", this.close.bind(this));
    resetButton.addEventListener("click", () => {
      this.#draft = { ...DEFAULT_SHORTCUTS };
      this.#stopCapture();
      this.#clearStatus();
      this.#render();
      this.#persist();
    });

    this.#overlayManager.register(this.#dialog);
    this.#dialog.addEventListener("close", () => {
      this.#stopCapture();
    });
  }

  async open() {
    this.#draft = parseShortcutsPreference(AppOptions.get("keyboardShortcuts"));
    this.#stopCapture();
    this.#clearStatus();
    await this.#render();
    await this.#overlayManager.open(this.#dialog);
  }

  async close() {
    this.#stopCapture();
    await this.#overlayManager.close(this.#dialog);
  }

  #startCapture(actionId) {
    this.#capturingActionId = actionId;
    this.#clearStatus();
    if (!this.#captureListening) {
      // Listen on window in the capture phase so key events are seen even
      // after #render() replaces the focused binding button.
      window.addEventListener("keydown", this.#boundKeyDown, true);
      this.#captureListening = true;
    }
  }

  #stopCapture() {
    this.#capturingActionId = null;
    if (this.#captureListening) {
      window.removeEventListener("keydown", this.#boundKeyDown, true);
      this.#captureListening = false;
    }
  }

  #focusCapturingButton() {
    const actionId = this.#capturingActionId;
    if (!actionId) {
      return;
    }
    const button = this.#list.querySelector(
      `.shortcutsBinding[data-action-id="${CSS.escape(actionId)}"]`
    );
    button?.focus({ preventScroll: true });
  }

  #clearStatus() {
    this.#status.textContent = "";
    this.#status.removeAttribute("data-l10n-id");
    this.#status.removeAttribute("data-l10n-args");
    this.#status.classList.remove("error");
    this.#status.hidden = true;
  }

  async #setStatusL10n(id, args = null, isError = true) {
    this.#status.hidden = false;
    this.#status.classList.toggle("error", isError);
    this.#status.setAttribute("data-l10n-id", id);
    if (args) {
      this.#status.setAttribute("data-l10n-args", JSON.stringify(args));
    } else {
      this.#status.removeAttribute("data-l10n-args");
    }
    // Ensure the status is visible even if translation is slow/unavailable.
    this.#status.textContent = id;
    await this.#l10n.translateOnce(this.#status);
  }

  async #render() {
    const fragment = document.createDocumentFragment();
    for (const actionId of getConfigurableActionIds()) {
      const meta = getActionMeta(actionId);
      const row = document.createElement("div");
      row.className = "shortcutsRow";
      row.dataset.actionId = actionId;

      const label = document.createElement("span");
      label.className = "shortcutsAction";
      if (meta?.l10nId) {
        label.setAttribute("data-l10n-id", meta.l10nId);
        if (meta.l10nArgs) {
          label.setAttribute("data-l10n-args", JSON.stringify(meta.l10nArgs));
        }
      } else {
        label.textContent = actionId;
      }

      const bindingButton = document.createElement("button");
      bindingButton.type = "button";
      bindingButton.className = "dialogButton shortcutsBinding";
      bindingButton.dataset.actionId = actionId;
      const binding = this.#draft[actionId] || "";
      if (this.#capturingActionId === actionId) {
        bindingButton.classList.add("capturing");
        bindingButton.setAttribute("data-l10n-id", "pdfjs-shortcuts-press-key");
      } else if (binding) {
        bindingButton.textContent = formatBindingLabel(binding);
      } else {
        bindingButton.setAttribute(
          "data-l10n-id",
          "pdfjs-shortcuts-unassigned"
        );
      }
      bindingButton.addEventListener("click", () => {
        this.#startCapture(actionId);
        this.#render().then(() => this.#focusCapturingButton());
      });

      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "dialogButton shortcutsClear";
      clearButton.setAttribute("data-l10n-id", "pdfjs-shortcuts-clear-button");
      clearButton.disabled = !binding;
      clearButton.addEventListener("click", () => {
        this.#draft[actionId] = "";
        this.#stopCapture();
        this.#clearStatus();
        this.#render();
        this.#persist();
      });

      row.append(label, bindingButton, clearButton);
      fragment.append(row);
    }
    this.#list.replaceChildren(fragment);
    await this.#l10n.translateOnce(this.#list);
  }

  async #onCaptureKeyDown(evt) {
    if (!this.#capturingActionId) {
      return;
    }
    if (evt.key === "Escape") {
      this.#stopCapture();
      this.#clearStatus();
      await this.#render();
      evt.preventDefault();
      evt.stopPropagation();
      return;
    }
    if (evt.key === "Tab") {
      return;
    }

    const binding = bindingFromEvent(evt);
    evt.preventDefault();
    evt.stopPropagation();
    if (!binding) {
      return;
    }

    const actionId = this.#capturingActionId;
    const result = validateBinding(this.#draft, actionId, binding);
    if (!result.ok) {
      if (result.reason === "collision") {
        await this.#setStatusL10n("pdfjs-shortcuts-collision", {
          action: result.conflictActionId,
        });
      } else if (result.reason === "reserved") {
        await this.#setStatusL10n("pdfjs-shortcuts-reserved");
      } else {
        await this.#setStatusL10n("pdfjs-shortcuts-invalid");
      }
      return;
    }

    this.#draft[actionId] = binding;
    this.#stopCapture();
    this.#clearStatus();
    await this.#render();
    await this.#persist();
  }

  async #persist() {
    const value = serializeShortcutsPreference(this.#draft);
    AppOptions.set("keyboardShortcuts", value);
    await this.#preferences.set("keyboardShortcuts", value);
  }
}

export { KeyboardShortcutsDialog };
