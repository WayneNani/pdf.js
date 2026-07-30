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
  AnnotationEditorParamsType,
  AnnotationEditorType,
  shadow,
  Util,
} from "../../shared/util.js";
import { bindEvents, KeyboardManager } from "./tools.js";
import {
  SquigglyAnnotationElement,
  UnderlineAnnotationElement,
} from "../annotation_layer.js";
import { AnnotationEditor } from "./editor.js";
import { ColorPicker } from "./color_picker.js";
import { HighlightOutliner } from "./drawers/highlight.js";
import { MathClamp } from "../../shared/math_clamp.js";

/**
 * Editor for underline / squiggly text-markup annotations.
 * solid→Underline, wavy→Squiggly, dotted→Underline+dashed AP.
 */
class UnderlineEditor extends AnnotationEditor {
  #anchorNode = null;

  #anchorOffset = 0;

  #boxes;

  #clipPathId = null;

  #colorPicker = null;

  #focusOutlines = null;

  #focusNode = null;

  #focusOffset = 0;

  #firstPoint = null;

  #id = null;

  #lastPoint = null;

  #outlineId = null;

  #style;

  #text = "";

  #underlineDiv = null;

  #underlineOutlines = null;

  static _defaultColor = null;

  static _defaultOpacity = 1;

  static _defaultStyle = "solid";

  static _type = "underline";

  static _editorType = AnnotationEditorType.UNDERLINE;

  static get _keyboardManager() {
    const proto = UnderlineEditor.prototype;
    return shadow(
      this,
      "_keyboardManager",
      new KeyboardManager([
        [["ArrowLeft"], proto._moveCaret, { args: [0] }],
        [["ArrowRight"], proto._moveCaret, { args: [1] }],
        [["ArrowUp"], proto._moveCaret, { args: [2] }],
        [["ArrowDown"], proto._moveCaret, { args: [3] }],
      ])
    );
  }

  constructor(params) {
    super({ ...params, name: "underlineEditor" });
    this.color = params.color || UnderlineEditor._defaultColor;
    this.opacity = params.opacity || UnderlineEditor._defaultOpacity;
    this.#style = params.style || UnderlineEditor._defaultStyle;
    this.#boxes = params.boxes || null;
    this.#text = params.text || "";
    this._isDraggable = false;
    this.defaultL10nId = "pdfjs-editor-underline-editor";

    if (this.#boxes) {
      this.#anchorNode = params.anchorNode;
      this.#anchorOffset = params.anchorOffset;
      this.#focusNode = params.focusNode;
      this.#focusOffset = params.focusOffset;
      this.#createOutlines();
      this.#addToDrawLayer();
      this.rotate(this.rotation);
    }

    if (!this.annotationElementId) {
      this._uiManager.a11yAlert(AnnotationEditor._l10nAlert.underline);
    }
  }

  /** @inheritdoc */
  get telemetryInitialData() {
    return {
      action: "added",
      type: "underline",
      color: this._uiManager.getNonHCMColorName(this.color),
      style: this.#style,
      methodOfCreation: "",
    };
  }

  /** @inheritdoc */
  get telemetryFinalData() {
    return {
      type: "underline",
      color: this._uiManager.getNonHCMColorName(this.color),
    };
  }

  static computeTelemetryFinalData(data) {
    return { numberOfColors: data.get("color").size };
  }

  /**
   * `Range.getClientRects()` often yields one rect per text node/span, so a
   * single visual line can produce several nearly-overlapping boxes. Drawing
   * (and serializing) one underline per box stacks parallel strokes. Merge
   * boxes that share a line into one quad spanning the full line width.
   * @param {Array<{x: number, y: number, width: number, height: number}>} boxes
   * @returns {Array<{x: number, y: number, width: number, height: number}>}
   */
  static #mergeBoxesByLine(boxes) {
    if (!boxes || boxes.length <= 1) {
      return boxes;
    }
    const sorted = boxes.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    const merged = [];
    for (const box of sorted) {
      const last = merged.at(-1);
      if (last) {
        const top = Math.max(last.y, box.y);
        const bottom = Math.min(last.y + last.height, box.y + box.height);
        const overlap = bottom - top;
        // Same line if vertical ranges overlap by ≥ half the shorter box.
        if (overlap > 0.5 * Math.min(last.height, box.height)) {
          const x1 = Math.min(last.x, box.x);
          const y1 = Math.min(last.y, box.y);
          const x2 = Math.max(last.x + last.width, box.x + box.width);
          const y2 = Math.max(last.y + last.height, box.y + box.height);
          last.x = x1;
          last.y = y1;
          last.width = x2 - x1;
          last.height = y2 - y1;
          continue;
        }
      }
      merged.push({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      });
    }
    return merged;
  }

  #createOutlines() {
    this.#boxes = UnderlineEditor.#mergeBoxesByLine(this.#boxes);

    const outliner = new HighlightOutliner(
      this.#boxes,
      /* borderWidth = */ 0.001
    );
    this.#underlineOutlines = outliner.getOutlines();
    [this.x, this.y, this.width, this.height] = this.#underlineOutlines.box;

    const outlinerForOutline = new HighlightOutliner(
      this.#boxes,
      /* borderWidth = */ 0.0025,
      /* innerMargin = */ 0.001,
      this._uiManager.direction === "ltr"
    );
    this.#focusOutlines = outlinerForOutline.getOutlines();

    const { firstPoint } = this.#underlineOutlines;
    this.#firstPoint = [
      (firstPoint[0] - this.x) / this.width,
      (firstPoint[1] - this.y) / this.height,
    ];
    const { lastPoint } = this.#focusOutlines;
    this.#lastPoint = [
      (lastPoint[0] - this.x) / this.width,
      (lastPoint[1] - this.y) / this.height,
    ];
  }

  /**
   * Build an SVG path for the underline stroke in box-local coordinates.
   * The draw layer SVG uses viewBox "0 0 1 1" mapped to the outline bbox,
   * so page-space box coords must be converted the same way
   * HighlightOutliner does.
   * @returns {string}
   */
  #underlinePath() {
    const [bx, by, bw, bh] = this.#underlineOutlines.box;
    const toLocal = (px, py) => [(px - bx) / bw, (py - by) / bh];
    const parts = [];
    for (const { x, y, width, height } of this.#boxes) {
      // Above the box bottom so the stroke sits under the glyphs.
      const yLine = y + height - Math.min(0.008, height * 0.15);
      if (this.#style === "wavy") {
        // Spellcheck-like sinusoidal curlies: quadratic arcs (soft, not
        // sawtooth). Control-point offset is ~2× the rendered peak height
        // of a Q mid-arc — keep amp high enough that waves stay clearly
        // distinct from solid under the non-scaling stroke.
        const amp = Math.min(0.007, height * 0.14);
        const halfPeriod = MathClamp(height * 0.1, 0.003, 0.005);
        const [sx, sy] = toLocal(x, yLine);
        parts.push(`M ${sx} ${sy}`);
        let cx = x;
        let up = true;
        const endX = x + width;
        while (cx < endX - 1e-6) {
          const half = Math.min(halfPeriod, endX - cx);
          const midX = cx + half / 2;
          const nextX = cx + half;
          const [cpx, cpy] = toLocal(midX, yLine + (up ? -amp : amp));
          const [nx, ny] = toLocal(nextX, yLine);
          parts.push(`Q ${cpx} ${cpy} ${nx} ${ny}`);
          cx = nextX;
          up = !up;
        }
      } else {
        const [sx, sy] = toLocal(x, yLine);
        const [ex, ey] = toLocal(x + width, yLine);
        parts.push(`M ${sx} ${sy} L ${ex} ${ey}`);
      }
    }
    return parts.join(" ");
  }

  #strokeDashArray() {
    return this.#style === "dotted" ? "0.012 0.01" : null;
  }

  /** @inheritdoc */
  static initialize(l10n, uiManager) {
    AnnotationEditor.initialize(l10n, uiManager);
    UnderlineEditor._defaultColor ||=
      uiManager.underlineColors?.values().next().value ||
      uiManager.highlightColors?.values().next().value ||
      "#ff0000";
  }

  /** @inheritdoc */
  static updateDefaultParams(type, value) {
    switch (type) {
      case AnnotationEditorParamsType.UNDERLINE_COLOR:
        UnderlineEditor._defaultColor = value.toUpperCase();
        break;
      case AnnotationEditorParamsType.UNDERLINE_STYLE:
        UnderlineEditor._defaultStyle = value;
        break;
    }
  }

  /** @inheritdoc */
  translateInPage(x, y) {}

  /** @inheritdoc */
  get toolbarPosition() {
    return this.#lastPoint;
  }

  /** @inheritdoc */
  get commentButtonPosition() {
    return this.#firstPoint;
  }

  /**
   * Line style of this underline (`solid` / `wavy` / `dotted`).
   * Exposed so the UI manager can mirror it into the "for new" default
   * when this editor is selected (parity with `color`).
   * @type {string}
   */
  get style() {
    return this.#style;
  }

  /** @inheritdoc */
  updateParams(type, value) {
    switch (type) {
      case AnnotationEditorParamsType.UNDERLINE_COLOR:
        this.#updateColor(value);
        break;
      case AnnotationEditorParamsType.UNDERLINE_STYLE:
        this.#updateStyle(value);
        break;
    }
  }

  static get defaultPropertiesToUpdate() {
    return [
      [
        AnnotationEditorParamsType.UNDERLINE_COLOR,
        UnderlineEditor._defaultColor,
      ],
      [
        AnnotationEditorParamsType.UNDERLINE_STYLE,
        UnderlineEditor._defaultStyle,
      ],
    ];
  }

  /** @inheritdoc */
  get propertiesToUpdate() {
    return [
      [
        AnnotationEditorParamsType.UNDERLINE_COLOR,
        this.color || UnderlineEditor._defaultColor,
      ],
      [
        AnnotationEditorParamsType.UNDERLINE_STYLE,
        this.#style || UnderlineEditor._defaultStyle,
      ],
    ];
  }

  /** @inheritdoc */
  onUpdatedColor() {
    this.parent?.drawLayer.updateProperties(this.#id, {
      root: {
        stroke: this.color,
        "stroke-opacity": this.opacity,
      },
    });
    this.#colorPicker?.updateColor(this.color);
    super.onUpdatedColor();
  }

  #updateColor(color) {
    const setColorAndOpacity = (col, opa) => {
      this.color = col;
      this.opacity = opa;
      this.onUpdatedColor();
    };
    const savedColor = this.color;
    const savedOpacity = this.opacity;
    this.addCommands({
      cmd: setColorAndOpacity.bind(
        this,
        color,
        UnderlineEditor._defaultOpacity
      ),
      undo: setColorAndOpacity.bind(this, savedColor, savedOpacity),
      post: this._uiManager.updateUI.bind(this._uiManager, this),
      mustExec: true,
      type: AnnotationEditorParamsType.UNDERLINE_COLOR,
      overwriteIfSameType: true,
      keepUndo: true,
    });
  }

  #updateStyle(style) {
    const setStyle = s => {
      this.#style = s;
      this.parent?.drawLayer.updateProperties(this.#id, {
        path: {
          d: this.#underlinePath(),
        },
        root: {
          "stroke-dasharray": this.#strokeDashArray(),
        },
      });
    };
    const saved = this.#style;
    this.addCommands({
      cmd: setStyle.bind(this, style),
      undo: setStyle.bind(this, saved),
      post: this._uiManager.updateUI.bind(this._uiManager, this),
      mustExec: true,
      type: AnnotationEditorParamsType.UNDERLINE_STYLE,
      overwriteIfSameType: true,
      keepUndo: true,
    });
  }

  /** @inheritdoc */
  get toolbarButtons() {
    if (this._uiManager.underlineColors || this._uiManager.highlightColors) {
      const colorPicker = (this.#colorPicker = new ColorPicker({
        editor: this,
      }));
      return [["colorPicker", colorPicker]];
    }
    return super.toolbarButtons;
  }

  /** @inheritdoc */
  disableEditing() {
    super.disableEditing();
    this.div.classList.toggle("disabled", true);
  }

  /** @inheritdoc */
  enableEditing() {
    super.enableEditing();
    this.div.classList.toggle("disabled", false);
  }

  /** @inheritdoc */
  fixAndSetPosition() {
    return super.fixAndSetPosition(0);
  }

  /** @inheritdoc */
  getBaseTranslation() {
    return [0, 0];
  }

  /** @inheritdoc */
  getRect(tx, ty) {
    return super.getRect(tx, ty, 0);
  }

  /** @inheritdoc */
  onceAdded(focus) {
    if (!this.annotationElementId) {
      this.parent.addUndoableEditor(this);
    }
    if (focus) {
      this.div.focus();
    }
  }

  /** @inheritdoc */
  remove() {
    this.#cleanDrawLayer();
    this._reportTelemetry({
      action: "deleted",
    });
    super.remove();
  }

  /** @inheritdoc */
  rebuild() {
    if (!this.parent) {
      return;
    }
    super.rebuild();
    if (this.div === null) {
      return;
    }

    this.#addToDrawLayer();

    if (!this.isAttachedToDOM) {
      this.parent.add(this);
    }
  }

  setParent(parent) {
    let mustBeSelected = false;
    if (this.parent && !parent) {
      this.#cleanDrawLayer();
    } else if (parent) {
      this.#addToDrawLayer(parent);
      mustBeSelected =
        !this.parent && this.div?.classList.contains("selectedEditor");
    }
    super.setParent(parent);
    this.show(this._isVisible);
    if (mustBeSelected) {
      this.select();
    }
  }

  #cleanDrawLayer() {
    if (this.#id === null || !this.parent) {
      return;
    }
    this.parent.drawLayer.remove(this.#id);
    this.#id = null;
    this.parent.drawLayer.remove(this.#outlineId);
    this.#outlineId = null;
  }

  #addToDrawLayer(parent = this.parent) {
    if (this.#id !== null || !this.#underlineOutlines) {
      return;
    }
    ({ id: this.#id, clipPathId: this.#clipPathId } = parent.drawLayer.draw(
      {
        bbox: this.#underlineOutlines.box,
        root: {
          viewBox: "0 0 1 1",
          fill: "none",
          stroke: this.color,
          "stroke-opacity": this.opacity,
          "stroke-width": "1.5",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "stroke-dasharray": this.#strokeDashArray(),
        },
        rootClass: {
          underline: true,
        },
        path: {
          d: this.#underlinePath(),
        },
      },
      /* isPathUpdatable = */ false,
      /* hasClip = */ true
    ));
    this.#outlineId = parent.drawLayer.drawOutline(
      {
        rootClass: {
          highlightOutline: true,
        },
        bbox: this.#focusOutlines.box,
        path: {
          d: this.#focusOutlines.toSVGPath(),
        },
      },
      /* mustRemoveSelfIntersections = */ false
    );

    if (this.#underlineDiv) {
      this.#underlineDiv.style.clipPath = this.#clipPathId;
    }
  }

  static #rotateBbox([x, y, width, height], angle) {
    switch (angle) {
      case 90:
        return [1 - y - height, x, height, width];
      case 180:
        return [1 - x - width, 1 - y - height, width, height];
      case 270:
        return [y, 1 - x - width, height, width];
    }
    return [x, y, width, height];
  }

  /** @inheritdoc */
  rotate(angle) {
    const { drawLayer } = this.parent;
    const box = UnderlineEditor.#rotateBbox(
      [this.x, this.y, this.width, this.height],
      angle
    );
    drawLayer.updateProperties(this.#id, {
      bbox: box,
      root: {
        "data-main-rotation": angle,
      },
    });
    drawLayer.updateProperties(this.#outlineId, {
      bbox: UnderlineEditor.#rotateBbox(this.#focusOutlines.box, angle),
      root: {
        "data-main-rotation": angle,
      },
    });
  }

  /** @inheritdoc */
  render() {
    if (this.div) {
      return this.div;
    }

    const div = super.render();
    if (this.#text) {
      div.setAttribute("aria-label", this.#text);
      div.setAttribute("role", "mark");
    }
    this.div.addEventListener("keydown", this.#keydown.bind(this), {
      signal: this._uiManager._signal,
    });
    const underlineDiv = (this.#underlineDiv = document.createElement("div"));
    div.append(underlineDiv);
    underlineDiv.setAttribute("aria-hidden", "true");
    underlineDiv.className = "internal";
    underlineDiv.style.clipPath = this.#clipPathId;
    this.setDims();

    bindEvents(this, this.#underlineDiv, ["pointerover", "pointerleave"]);
    this.enableEditing();

    return div;
  }

  pointerover() {
    if (!this.isSelected) {
      this.parent?.drawLayer.updateProperties(this.#outlineId, {
        rootClass: {
          hovered: true,
        },
      });
    }
  }

  pointerleave() {
    if (!this.isSelected) {
      this.parent?.drawLayer.updateProperties(this.#outlineId, {
        rootClass: {
          hovered: false,
        },
      });
    }
  }

  #keydown(event) {
    UnderlineEditor._keyboardManager.exec(this, event);
  }

  _moveCaret(direction) {
    this.parent.unselect(this);
    switch (direction) {
      case 0:
      case 2:
        this.#setCaret(/* start = */ true);
        break;
      case 1:
      case 3:
        this.#setCaret(/* start = */ false);
        break;
    }
  }

  #setCaret(start) {
    if (!this.#anchorNode) {
      return;
    }
    const selection = window.getSelection();
    if (start) {
      selection.setPosition(this.#anchorNode, this.#anchorOffset);
    } else {
      selection.setPosition(this.#focusNode, this.#focusOffset);
    }
  }

  /** @inheritdoc */
  select() {
    super.select();
    if (!this.#outlineId) {
      return;
    }
    this.parent?.drawLayer.updateProperties(this.#outlineId, {
      rootClass: {
        hovered: false,
        selected: true,
      },
    });
  }

  /** @inheritdoc */
  unselect() {
    super.unselect();
    if (!this.#outlineId) {
      return;
    }
    this.parent?.drawLayer.updateProperties(this.#outlineId, {
      rootClass: {
        selected: false,
      },
    });
    this.#setCaret(/* start = */ false);
  }

  /** @inheritdoc */
  get _mustFixPosition() {
    return true;
  }

  /** @inheritdoc */
  show(visible = this._isVisible) {
    super.show(visible);
    if (this.parent) {
      this.parent.drawLayer.updateProperties(this.#id, {
        rootClass: {
          hidden: !visible,
        },
      });
      this.parent.drawLayer.updateProperties(this.#outlineId, {
        rootClass: {
          hidden: !visible,
        },
      });
    }
  }

  #serializeBoxes() {
    const [pageWidth, pageHeight] = this.pageDimensions;
    const [pageX, pageY] = this.pageTranslation;
    const boxes = this.#boxes;
    const quadPoints = new Float32Array(boxes.length * 8);
    let i = 0;
    for (const { x, y, width, height } of boxes) {
      const sx = x * pageWidth + pageX;
      const sy = (1 - y) * pageHeight + pageY;
      quadPoints[i] = quadPoints[i + 4] = sx;
      quadPoints[i + 1] = quadPoints[i + 3] = sy;
      quadPoints[i + 2] = quadPoints[i + 6] = sx + width * pageWidth;
      quadPoints[i + 5] = quadPoints[i + 7] = sy - height * pageHeight;
      i += 8;
    }
    return quadPoints;
  }

  /** @inheritdoc */
  static async deserialize(data, parent, uiManager) {
    let initialData = null;
    if (
      data instanceof UnderlineAnnotationElement ||
      data instanceof SquigglyAnnotationElement
    ) {
      const {
        data: {
          quadPoints,
          rect,
          rotation,
          id,
          color,
          opacity,
          popupRef,
          richText,
          contentsObj,
          creationDate,
          modificationDate,
          lineStyle,
        },
        parent: {
          page: { pageNumber },
        },
      } = data;
      const isSquiggly = data instanceof SquigglyAnnotationElement;
      initialData = data = {
        annotationType: AnnotationEditorType.UNDERLINE,
        color: Array.from(color),
        opacity: opacity ?? 1,
        style: isSquiggly ? "wavy" : lineStyle || "solid",
        quadPoints,
        boxes: null,
        pageIndex: pageNumber - 1,
        rect: rect.slice(0),
        rotation,
        annotationElementId: id,
        id,
        deleted: false,
        popupRef,
        richText,
        comment: contentsObj?.str || null,
        creationDate,
        modificationDate,
      };
    }

    const { color, quadPoints, opacity } = data;
    const editor = await super.deserialize(data, parent, uiManager);

    editor.color = Util.makeHexColor(...color);
    editor.opacity = opacity || 1;
    editor.#style = data.style || UnderlineEditor._defaultStyle;
    editor._initialData = initialData;
    if (data.comment) {
      editor.setCommentData(data);
    }

    const [pageWidth, pageHeight] = editor.pageDimensions;
    const [pageX, pageY] = editor.pageTranslation;

    if (quadPoints) {
      const boxes = (editor.#boxes = []);
      for (let i = 0; i < quadPoints.length; i += 8) {
        boxes.push({
          x: (quadPoints[i] - pageX) / pageWidth,
          y: 1 - (quadPoints[i + 1] - pageY) / pageHeight,
          width: (quadPoints[i + 2] - quadPoints[i]) / pageWidth,
          height: (quadPoints[i + 1] - quadPoints[i + 5]) / pageHeight,
        });
      }
      editor.#createOutlines();
      editor.#addToDrawLayer();
      editor.rotate(editor.rotation);
    }

    return editor;
  }

  /** @inheritdoc */
  serialize(isForCopying = false) {
    if (this.isEmpty() || isForCopying) {
      return null;
    }

    if (this.deleted) {
      return this.serializeDeleted();
    }

    const color = AnnotationEditor._colorManager.convert(
      this._uiManager.getNonHCMColor(this.color)
    );
    const serialized = super.serialize(isForCopying);
    Object.assign(serialized, {
      annotationType: AnnotationEditorType.UNDERLINE,
      color,
      opacity: this.opacity,
      style: this.#style,
      quadPoints: this.#serializeBoxes(),
    });
    this.addComment(serialized);

    if (this.annotationElementId && !this.#hasElementChanged(serialized)) {
      return null;
    }

    serialized.id = this.annotationElementId;
    return serialized;
  }

  #hasElementChanged(serialized) {
    const { color, style } = this._initialData || {};
    return (
      this.hasEditedComment ||
      serialized.style !== style ||
      serialized.color.some((c, i) => c !== color[i])
    );
  }

  /** @inheritdoc */
  renderAnnotationElement(annotation) {
    if (this.deleted) {
      annotation.hide();
      return null;
    }
    annotation.updateEdited({
      rect: this.getPDFRect(),
      popup: this.comment,
    });

    return null;
  }

  static canCreateNewEmptyEditor() {
    return false;
  }
}

export { UnderlineEditor };
