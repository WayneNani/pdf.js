# PDF-Editor Prototyp

Working Prototyp zum **Öffnen, Bearbeiten und Speichern** von PDFs mit dem Standard-PDF.js-Viewer.

## Voraussetzungen

- Node.js **>= 22.13** (oder >= 24)
- npm

## Starten

```bash
npm install
npm start
```

Der Dev-Server startet auf Port **8888**.

Im Browser öffnen:

**http://localhost:8888/web/viewer.html**

Test-PDFs zum Ausprobieren:

**http://localhost:8888/test/pdfs/?frame**

## PDF öffnen

Es gibt drei Wege, ein PDF zu laden:

1. **Drag & Drop** — PDF-Datei auf den Viewer ziehen
2. **Datei-Dialog** — Toolbar **Tools** (⋮) → **Open**
3. **URL-Parameter** — z. B. `viewer.html?file=/test/pdfs/tracemonkey.pdf`

## PDF bearbeiten

### Annotationen

In der Toolbar stehen folgende Werkzeuge zur Verfügung:

| Werkzeug | Funktion |
|----------|----------|
| **Highlight** | Text markieren |
| **Free Text** | Freitextfeld platzieren |
| **Ink** | Freihand zeichnen |
| **Stamp** | Bild/Stempel einfügen |
| **Signature** | Signatur hinzufügen |
| **Comment** | Kommentar anfügen |

Parameter wie Farbe, Schriftgröße oder Strichstärke lassen sich über die Dropdown-Panels neben den Werkzeugen anpassen.

Beim Werkzeug **Free Text** stehen für die Schriftgröße ein **Slider** und ein **numerisches Eingabefeld** zur Verfügung (1–100 pt). Beide Controls sind synchron: Änderungen am Slider werden im Zahlenfeld angezeigt und umgekehrt. Für sehr kleine Schriftgrößen kann direkt ein Wert ab **1 pt** eingegeben werden.

### Formularfelder

AcroForm-Felder (Textfelder, Checkboxen, Dropdowns) können direkt im Dokument angeklickt und ausgefüllt werden.

## PDF speichern

- Button **Save** in der Toolbar klicken
- Das bearbeitete PDF wird als Download bereitgestellt
- Annotationen und Formularwerte werden in die PDF-Datei eingebettet

**Hinweis:** Speichern erfolgt als Browser-Download. Die Originaldatei auf der Festplatte wird nicht überschrieben.

## Bekannte Grenzen

- **Kein Bearbeiten des Original-Inhalts** — Text und Grafik im PDF-Stream selbst können nicht geändert werden; es werden Overlays/Annotationen hinzugefügt
- **XFA-Formulare** — Anzeige und Ausfüllen sind eingeschränkt; kein XFA-Editing
- **Speichern** — nur als Download, kein direktes Überschreiben der Quelldatei

## Architektur (Kurzüberblick)

```
PDF öffnen  →  getDocument()  →  PDFViewer
Bearbeiten  →  AnnotationEditorLayer + AnnotationLayer (Formulare)
Speichern   →  annotationStorage  →  saveDocument()  →  Download
```

Relevante Dateien:

- [`web/viewer.html`](web/viewer.html) — Viewer-Oberfläche
- [`web/app.js`](web/app.js) — Anwendungslogik (Öffnen, Speichern)
- [`web/app_options.js`](web/app_options.js) — Feature-Konfiguration
- [`src/display/editor/`](src/display/editor/) — Annotation-Editoren
