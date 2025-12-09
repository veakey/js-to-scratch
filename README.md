# js-to-scratch

A translator that converts JavaScript code to Scratch 3.0 projects

This project aims to translate JavaScript projects into Scratch projects with support for both command-line interface and a beautiful web UI with glass design.

## Features

- **Dual Interface**: Command-line tool and web-based drag-and-drop interface
- **Glass UI Design**: Modern, elegant web interface with glass morphism
- **Unsupported Feature Detection**: Automatically detects and reports JavaScript features that don't exist in Scratch
- **Scratch 3.0 Compatible**: Generates valid Scratch 3.0 project files (.sb3)
- **Real-time Translation**: Instant feedback on code translation
- **Direct Upload**: Generated .sb3 files can be uploaded directly to Scratch website

## Installation

```bash
npm install
```

## Usage

### Command Line Interface (CLI)

The CLI allows you to translate JavaScript files or zip archives containing JavaScript projects.

#### Translate a single JavaScript file:

```bash
npm run cli -- translate examples/simple.js
```

This will generate a `.sb3` file in the same directory as the input file.

#### Translate with a custom output file:

```bash
npm run cli -- translate examples/simple.js -o output.sb3
```

#### Translate a zip archive:

You can also provide a zip file containing JavaScript, CSS, and HTML files. Only the JavaScript files will be translated.

```bash
npm run cli -- translate project.zip -o output.sb3
```

**Requirements for zip files:**
- The zip file must contain `.js`, `.css`, and/or `.html` files in the root directory
- All JavaScript files will be combined and translated
- CSS and HTML files will be ignored but are allowed in the archive

### Web Interface (UI)

The web interface provides a user-friendly way to translate your code with drag-and-drop support.

#### Start the web server:

```bash
npm start
```

Then open your browser to `http://localhost:3000`

#### Features:

- **Drag and drop** JavaScript files (`.js`) or zip archives (`.zip`) for translation
- **Click to browse** files from your computer
- **Paste code directly** into the editor for quick translations
- **Automatic download** of the resulting Scratch project as a `.sb3` file
- **File size limit**: 10MB for uploads
- **Supported formats**: `.js` files or `.zip` archives containing `.js`, `.css`, and `.html` files

#### Usage instructions:

1. Either drag & drop a file onto the drop zone, or click "Choose File" to browse
2. For zip files: ensure they contain at least one JavaScript file in the root
3. The translation happens automatically upon file upload
4. Download the generated `.sb3` file
5. Upload the `.sb3` file to https://scratch.mit.edu/ to view your project

## Supported JavaScript Features

The translator supports a subset of JavaScript features that can be mapped to Scratch blocks:

- Variables (`let`, `const`, `var`)
- Basic arithmetic operations (`+`, `-`, `*`, `/`)
- Comparison operators (`<`, `>`, `==`, `===`)
- Control structures:
  - `if` statements
  - `while` loops
  - `for` loops

## Unsupported Features

The following JavaScript features are **not supported** in Scratch and will throw visible exceptions:

- ❌ `window.location`
- ❌ `window.alert`
- ❌ `window.confirm`
- ❌ `window.prompt`
- ❌ `document.getElementById`
- ❌ `document.querySelector`
- ❌ `console.log`
- ❌ `localStorage`
- ❌ `sessionStorage`
- ❌ `fetch`
- ❌ `XMLHttpRequest`
- ❌ `setTimeout`
- ❌ `setInterval`
- ❌ `Promise`
- ❌ `async`/`await`

When these features are detected, the translator will throw a clear error message indicating:
- The unsupported feature name
- The line and column number where it appears
- A helpful message explaining why it's not supported

## Examples

### Example 1: Simple Code (Supported)

```javascript
let x = 10;
let y = 20;

if (x < y) {
    x = x + 1;
}
```

This code will be successfully translated to Scratch blocks.

### Example 2: Unsupported Features

```javascript
let x = 10;
window.alert("Hello!"); // ✗ Error: Unsupported feature
console.log(x);         // ✗ Error: Unsupported feature
```

This code will throw visible exceptions indicating which features are not supported.

## Project Structure

```
js-to-scratch/
├── src/
│   ├── translator/    # Core translation logic
│   ├── cli/           # Command-line interface
│   └── web/           # Web server and UI
│       ├── server.js
│       └── public/
│           ├── index.html
│           ├── styles.css
│           └── app.js
├── examples/          # Example JavaScript files
└── README.md
```

## Testing

The project includes comprehensive unit and functional tests.

### Run all tests:

```bash
npm test
```

### Test structure:

- **Unit tests**: Test individual modules and functions (`tests/unit/`)
- **Functional tests**: Test end-to-end functionality with real `.sb3` files (`tests/functional/`)
- **Test fixtures**: Sample JavaScript files and zip archives for testing (`tests/fixtures/`)

## Development

The project uses:
- **acorn**: JavaScript parser
- **commander**: CLI framework
- **express**: Web server
- **multer**: File upload handling
- **adm-zip**: Zip file handling
- **archiver**: Creating `.sb3` (zip) files
- **jest**: Testing framework

## License

ISC
