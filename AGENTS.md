## Overview

PDF.js is a Portable Document Format (PDF) viewer built with JavaScript, HTML5 Canvas, and CSS. It's a Mozilla project that provides a general-purpose, web standards-based platform for parsing and rendering PDFs without requiring native code or plugins.

## Common Commands

### Development Server
```bash
npx gulp server
```
Then open http://localhost:8888/web/viewer.html to view the PDF viewer. Test PDFs are available at http://localhost:8888/test/pdfs/?frame

### Building

Build for modern browsers:
```bash
npx gulp generic
```

This generates `pdf.js` and `pdf.worker.js` in `build/generic/build/`.

Build for distribution (creates pdfjs-dist package):
```bash
npx gulp dist
npx gulp dist-install    # Build and install locally
```

### Testing

Run all tests:
```bash
npx gulp test
```

Run unit tests only:
```bash
npx gulp unittest
```

Run integration tests (browser-based tests using Puppeteer):
```bash
npx gulp integrationtest
```

Run font tests:
```bash
npx gulp fonttest
```

Run a single test file by modifying test/test_manifest.json or using test runner options.

### Linting and Formatting

Lint JavaScript:
```bash
npx gulp lint
```

Format code (uses Prettier and ESLint):
```bash
npx eslint --fix <file>
```

### Type Checking

Run TypeScript type checking:
```bash
npx gulp typestest
```

## Architecture

### High-Level Structure

PDF.js has a multi-layer architecture that separates concerns between PDF parsing, rendering, and UI:

#### 1. Core Layer (`src/core/`)
The core layer handles PDF parsing and interpretation. Key responsibilities:
- **PDF parsing**: Parsing PDF structure, cross-reference tables, streams
- **Font handling**: CFF, TrueType, Type1 font parsing and conversion (`font.js`, `fonts.js`, `cff_*.js`, `type1_*.js`)
- **Image decoding**: JPEG, JBIG2, JPX/JPEG2000 decoders
- **Operators**: Processing PDF drawing operators (`operator_list.js`, `evaluator.js`)
- **XFA Forms**: XML Forms Architecture support (`src/core/xfa/`)
- **Color spaces**: ICC profiles, device color spaces (`colorspace.js`, `icc_colorspace.js`)
- Runs in a Web Worker for performance isolation

Entry point: `src/pdf.worker.js`

#### 2. Display Layer (`src/display/`)
The display layer provides the API for rendering PDFs to canvas and managing documents. Key components:
- **API**: Main public API (`api.js`) - `PDFDocumentProxy`, `PDFPageProxy`, `getDocument()`
- **Canvas rendering**: Renders PDF operations to HTML5 canvas (`canvas.js`)
- **Text layer**: Extracts and positions text for selection/search (`text_layer.js`)
- **Annotation layer**: Renders and handles PDF annotations (`annotation_layer.js`)
- **Editor layer**: Supports PDF editing (annotations, highlights, stamps) (`editor/`)
- **Metadata**: Parses XMP metadata (`metadata.js`)
- **Streams**: Handles PDF data fetching (fetch, network, node) (`fetch_stream.js`, `network.js`, `node_stream.js`)

Entry point: `src/pdf.js`

#### 3. Scripting Layer (`src/scripting_api/`)
Implements JavaScript execution for interactive PDFs (form calculations, validations, button actions).
- Sandboxed execution environment
- Implements Acrobat JavaScript API objects (App, Doc, Field, etc.)

Entry points: `src/pdf.scripting.js`, `src/pdf.sandbox.js`

#### 4. Web Viewer (`web/`)
The complete PDF viewer application with UI. Key components:
- **Main app**: Application orchestration (`app.js`)
- **Viewer**: Page rendering and layout (`pdf_viewer.js`, `pdf_page_view.js`)
- **Toolbar**: Zoom, page navigation, print, download controls
- **Sidebar**: Thumbnails, outlines, attachments (`pdf_sidebar.js`, `pdf_thumbnail_view.js`, `pdf_outline_viewer.js`)
- **Find controller**: Text search functionality (`pdf_find_controller.js`)
- **Annotation editors**: UI for creating/editing annotations (`annotation_editor_layer_builder.js`)
- **Presentation mode**: Full-screen presentation (`pdf_presentation_mode.js`)

Entry point: `web/viewer.html` + `web/viewer.mjs`

#### 5. Shared Utilities (`src/shared/`)
Common utilities used across layers:
- **Message handling**: Worker communication (`message_handler.js`)
- **Utilities**: Common functions and constants (`util.js`)
- **Image utilities**: Image processing helpers (`image_utils.js`)

### Worker Communication

PDF.js uses a Web Worker architecture:
- Main thread (`display` layer) communicates with worker thread (`core` layer) via `MessageHandler`
- Keeps PDF parsing off the main thread for better performance
- Messages include: page rendering requests, text content extraction, metadata queries

### Build System

- Uses **Gulp** for build orchestration (`gulpfile.mjs`)
- **Webpack** bundles modules into browser-compatible formats
- **Babel** transpiles for browser compatibility (configurable targets in gulpfile)
- Preprocessor replaces build-time constants (e.g., `typeof PDFJSDev !== "undefined"` checks)
- Multiple build targets: generic, components, minified, legacy (older browser support)

### External Dependencies

Located in `external/`:
- **bcmaps**: Binary CMaps for CJK fonts
- **standard_fonts**: Core 14 PDF fonts metrics
- **cmapscompress**: Tools for compressing CMaps
- **openjpeg**: JPEG2000 decoder (WASM)
- **quickjs**: JavaScript engine for sandboxed execution

### Translations

Translations in `l10n/` are imported from Mozilla Firefox Nightly. Only the file l10n/en-US/viewer.ftl can be updated.

## Development Notes

### Adding New Features

When adding features that span multiple layers:
1. Start with the `core` layer if parsing/interpretation changes are needed
2. Update the `display` layer API if new capabilities need exposure
3. Modify the `web` viewer if UI changes are required
4. Ensure worker communication handles new message types

### Preprocessor Directives

Code uses preprocessor checks for build-time conditionals:
```javascript
if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("GENERIC")) {
  // Generic build-specific code
}
```

Common flags: `GENERIC`, `MOZCENTRAL`, `CHROME`, `MINIFIED`, `TESTING`, `LIB`, `SKIP_BABEL`, `IMAGE_DECODERS`

### Testing

- Unit tests use Jasmine framework (`test/unit/`)
- Integration tests use Puppeteer for browser automation (`test/integration/`)
- Test PDFs downloaded from manifest (`test/test_manifest.json`)
- Reference images for visual regression testing (`test/ref/`)

### Code Style

- Uses ESLint with custom configuration (`eslint.config.mjs`)
- Prettier for formatting
- Stylelint for CSS
- No semicolons required (ASI enabled)
- Single quotes for strings

### Pull Request Process

- Keep PRs focused on a single issue
- Provide a test PDF if the issue is PDF-specific
- Ensure tests pass (`npx gulp test`)
- Run linting (`npx gulp lint`)
- Follow existing code patterns
- Don't modify translations directly (they come from Firefox)

### Performance Considerations

- Core parsing runs in a Web Worker - keep main thread work minimal
- Canvas rendering can be expensive - use appropriate scale factors
- Text layer generation is separate from rendering - can be deferred
- Annotation layer is optional - only enable when needed

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
