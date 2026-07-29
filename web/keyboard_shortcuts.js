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

/**
 * Configurable viewer keyboard shortcuts (annotation tools, colors, styles).
 * Bindings are stored as a JSON preference string (`keyboardShortcuts`).
 */

/** Modifier bitfield matching `web/app.js` onKeyDown. */
const MOD = {
  CTRL: 1,
  ALT: 2,
  SHIFT: 4,
  META: 8,
};

/**
 * Default bindings for configurable actions. Empty string = unbound.
 * Colors/styles start unbound so users opt in without colliding with
 * navigation keys (j/k/n/p, etc.).
 */
const DEFAULT_SHORTCUTS = Object.freeze({
  highlight: "h",
  underline: "u",
  select: "s",
  rotateCw: "r",
  "highlight.yellow": "",
  "highlight.green": "",
  "highlight.blue": "",
  "highlight.pink": "",
  "highlight.red": "",
  "highlight.orange": "",
  "highlight.purple": "",
  "highlight.cyan": "",
  "highlight.gray": "",
  "highlight.brown": "",
  "underline.solid": "",
  "underline.wavy": "",
  "underline.dotted": "",
});

/** Built-in cmd===0 keys that must not be stolen by user bindings. */
const RESERVED_BINDINGS = Object.freeze(
  new Set([
    "j",
    "k",
    "n",
    "p",
    " ",
    "arrowup",
    "arrowdown",
    "arrowleft",
    "arrowright",
    "pageup",
    "pagedown",
    "home",
    "end",
    "backspace",
    "escape",
    "f4",
  ])
);

const ACTION_META = Object.freeze({
  highlight: { kind: "tool", l10nId: "pdfjs-shortcuts-action-highlight" },
  underline: { kind: "tool", l10nId: "pdfjs-shortcuts-action-underline" },
  select: { kind: "tool", l10nId: "pdfjs-shortcuts-action-select" },
  rotateCw: { kind: "tool", l10nId: "pdfjs-shortcuts-action-rotate-cw" },
  "highlight.yellow": {
    kind: "color",
    color: "yellow",
    l10nId: "pdfjs-shortcuts-action-highlight-color",
    l10nArgs: { color: "yellow" },
  },
  "highlight.green": {
    kind: "color",
    color: "green",
    l10nId: "pdfjs-shortcuts-action-highlight-color",
    l10nArgs: { color: "green" },
  },
  "highlight.blue": {
    kind: "color",
    color: "blue",
    l10nId: "pdfjs-shortcuts-action-highlight-color",
    l10nArgs: { color: "blue" },
  },
  "highlight.pink": {
    kind: "color",
    color: "pink",
    l10nId: "pdfjs-shortcuts-action-highlight-color",
    l10nArgs: { color: "pink" },
  },
  "highlight.red": {
    kind: "color",
    color: "red",
    l10nId: "pdfjs-shortcuts-action-highlight-color",
    l10nArgs: { color: "red" },
  },
  "highlight.orange": {
    kind: "color",
    color: "orange",
    l10nId: "pdfjs-shortcuts-action-highlight-color",
    l10nArgs: { color: "orange" },
  },
  "highlight.purple": {
    kind: "color",
    color: "purple",
    l10nId: "pdfjs-shortcuts-action-highlight-color",
    l10nArgs: { color: "purple" },
  },
  "highlight.cyan": {
    kind: "color",
    color: "cyan",
    l10nId: "pdfjs-shortcuts-action-highlight-color",
    l10nArgs: { color: "cyan" },
  },
  "highlight.gray": {
    kind: "color",
    color: "gray",
    l10nId: "pdfjs-shortcuts-action-highlight-color",
    l10nArgs: { color: "gray" },
  },
  "highlight.brown": {
    kind: "color",
    color: "brown",
    l10nId: "pdfjs-shortcuts-action-highlight-color",
    l10nArgs: { color: "brown" },
  },
  "underline.solid": {
    kind: "style",
    style: "solid",
    l10nId: "pdfjs-shortcuts-action-underline-style",
    l10nArgs: { style: "solid" },
  },
  "underline.wavy": {
    kind: "style",
    style: "wavy",
    l10nId: "pdfjs-shortcuts-action-underline-style",
    l10nArgs: { style: "wavy" },
  },
  "underline.dotted": {
    kind: "style",
    style: "dotted",
    l10nId: "pdfjs-shortcuts-action-underline-style",
    l10nArgs: { style: "dotted" },
  },
});

/**
 * Normalize a binding string for storage/lookup.
 * @param {string} binding
 * @returns {string}
 */
function normalizeBinding(binding) {
  if (!binding || typeof binding !== "string") {
    return "";
  }
  const parts = binding
    .trim()
    .toLowerCase()
    .split("+")
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return "";
  }

  const mods = new Set();
  let key = "";
  for (const part of parts) {
    if (part === "ctrl" || part === "control") {
      mods.add("ctrl");
    } else if (part === "alt" || part === "option") {
      mods.add("alt");
    } else if (part === "shift") {
      mods.add("shift");
    } else if (part === "meta" || part === "cmd" || part === "command") {
      mods.add("meta");
    } else if (!key) {
      key = part === "space" ? " " : part;
    } else {
      return "";
    }
  }
  if (!key) {
    return "";
  }

  const ordered = [];
  if (mods.has("ctrl")) {
    ordered.push("ctrl");
  }
  if (mods.has("alt")) {
    ordered.push("alt");
  }
  if (mods.has("shift")) {
    ordered.push("shift");
  }
  if (mods.has("meta")) {
    ordered.push("meta");
  }
  ordered.push(key === " " ? "space" : key);
  return ordered.join("+");
}

/**
 * @param {string} binding
 * @returns {{ cmd: number, key: string } | null}
 */
function parseBinding(binding) {
  const normalized = normalizeBinding(binding);
  if (!normalized) {
    return null;
  }
  const parts = normalized.split("+");
  let cmd = 0;
  let key = parts.at(-1);
  for (let i = 0; i < parts.length - 1; i++) {
    switch (parts[i]) {
      case "ctrl":
        cmd |= MOD.CTRL;
        break;
      case "alt":
        cmd |= MOD.ALT;
        break;
      case "shift":
        cmd |= MOD.SHIFT;
        break;
      case "meta":
        cmd |= MOD.META;
        break;
    }
  }
  if (key === "space") {
    key = " ";
  }
  return { cmd, key };
}

/**
 * Build a binding string from a keyboard event (for capture UI).
 * @param {KeyboardEvent} evt
 * @returns {string}
 */
function bindingFromEvent(evt) {
  if (
    evt.key === "Shift" ||
    evt.key === "Control" ||
    evt.key === "Alt" ||
    evt.key === "Meta"
  ) {
    return "";
  }
  const parts = [];
  if (evt.ctrlKey) {
    parts.push("ctrl");
  }
  if (evt.altKey) {
    parts.push("alt");
  }
  if (evt.shiftKey) {
    parts.push("shift");
  }
  if (evt.metaKey) {
    parts.push("meta");
  }
  let key =
    evt.key.length === 1 ? evt.key.toLowerCase() : evt.key.toLowerCase();
  if (key === " ") {
    key = "space";
  }
  parts.push(key);
  return normalizeBinding(parts.join("+"));
}

/**
 * @param {string} preferenceValue
 * @returns {Record<string, string>}
 */
function parseShortcutsPreference(preferenceValue) {
  const result = { ...DEFAULT_SHORTCUTS };
  if (!preferenceValue || typeof preferenceValue !== "string") {
    return result;
  }
  try {
    const parsed = JSON.parse(preferenceValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return result;
    }
    for (const actionId of Object.keys(DEFAULT_SHORTCUTS)) {
      if (Object.hasOwn(parsed, actionId)) {
        result[actionId] = normalizeBinding(String(parsed[actionId] ?? ""));
      }
    }
  } catch {
    // Keep defaults on corrupt preference data.
  }
  return result;
}

/**
 * Serialize only non-default bindings to keep the preference small.
 * @param {Record<string, string>} shortcuts
 * @returns {string}
 */
function serializeShortcutsPreference(shortcuts) {
  const out = {};
  for (const actionId of Object.keys(DEFAULT_SHORTCUTS)) {
    const value = normalizeBinding(shortcuts[actionId] ?? "");
    const def = DEFAULT_SHORTCUTS[actionId];
    if (value !== def) {
      out[actionId] = value;
    }
  }
  return JSON.stringify(out);
}

/**
 * @param {Record<string, string>} shortcuts
 * @param {string} actionId
 * @param {string} binding
 * @returns {{ ok: true } |
 *   { ok: false, reason: string, conflictActionId?: string }}
 */
function validateBinding(shortcuts, actionId, binding) {
  if (!Object.hasOwn(DEFAULT_SHORTCUTS, actionId)) {
    return { ok: false, reason: "unknown-action" };
  }
  const normalized = normalizeBinding(binding);
  if (!normalized) {
    return { ok: true };
  }
  const parsed = parseBinding(normalized);
  if (!parsed) {
    return { ok: false, reason: "invalid" };
  }
  if (parsed.cmd === 0 && RESERVED_BINDINGS.has(parsed.key)) {
    return { ok: false, reason: "reserved" };
  }
  for (const [otherId, otherBinding] of Object.entries(shortcuts)) {
    if (otherId === actionId || !otherBinding) {
      continue;
    }
    if (normalizeBinding(otherBinding) === normalized) {
      return { ok: false, reason: "collision", conflictActionId: otherId };
    }
  }
  return { ok: true };
}

/**
 * Find the action matching a keyboard event under the given cmd bitfield.
 * @param {Record<string, string>} shortcuts
 * @param {number} cmd
 * @param {KeyboardEvent} evt
 * @returns {string | null}
 */
function matchShortcut(shortcuts, cmd, evt) {
  const key =
    evt.key.length === 1 ? evt.key.toLowerCase() : evt.key.toLowerCase();
  for (const [actionId, binding] of Object.entries(shortcuts)) {
    if (!binding) {
      continue;
    }
    const parsed = parseBinding(binding);
    if (!parsed || parsed.cmd !== cmd) {
      continue;
    }
    if (parsed.key === key) {
      return actionId;
    }
  }
  return null;
}

/**
 * Resolve a named highlight color from the `highlightEditorColors` pref.
 * @param {string} colorName
 * @param {string} colorsPref
 * @returns {string | null} hex color
 */
function resolveHighlightColor(colorName, colorsPref) {
  if (!colorName || !colorsPref) {
    return null;
  }
  for (const pair of colorsPref.split(",")) {
    const [name, value] = pair.split("=");
    if (!name || !value || name.endsWith("_HCM")) {
      continue;
    }
    if (name.trim().toLowerCase() === colorName.toLowerCase()) {
      return value.trim().toUpperCase();
    }
  }
  return null;
}

/**
 * Human-readable label for a binding (UI display).
 * @param {string} binding
 * @returns {string}
 */
function formatBindingLabel(binding) {
  const normalized = normalizeBinding(binding);
  if (!normalized) {
    return "";
  }
  return normalized
    .split("+")
    .map(part => {
      if (part === " ") {
        return "Space";
      }
      if (part === "space") {
        return "Space";
      }
      if (part.length === 1) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("+");
}

function getConfigurableActionIds() {
  return Object.keys(DEFAULT_SHORTCUTS);
}

function getActionMeta(actionId) {
  return ACTION_META[actionId] || null;
}

export {
  ACTION_META,
  bindingFromEvent,
  DEFAULT_SHORTCUTS,
  formatBindingLabel,
  getActionMeta,
  getConfigurableActionIds,
  matchShortcut,
  MOD,
  normalizeBinding,
  parseBinding,
  parseShortcutsPreference,
  RESERVED_BINDINGS,
  resolveHighlightColor,
  serializeShortcutsPreference,
  validateBinding,
};
