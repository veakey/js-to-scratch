# js-to-scratch

🎨 A translator that converts JavaScript code to Scratch 3.0 projects

This project aims to translate JavaScript projects into Scratch projects with support for both command-line interface and a beautiful web UI with glass design.

## Features

- ✨ **Dual Interface**: Command-line tool and web-based drag-and-drop interface
- 🎨 **Glass UI Design**: Modern, elegant web interface with glass morphism
- 🔍 **Unsupported Feature Detection**: Automatically detects and reports JavaScript features that don't exist in Scratch
- 📦 **Scratch 3.0 Compatible**: Generates valid Scratch 3.0 project files
- ⚡ **Real-time Translation**: Instant feedback on code translation

## Installation

```bash
npm install
```

## Usage

### Command Line Interface

Translate a JavaScript file to Scratch 3.0:

```bash
npm run cli translate examples/simple.js
```

Or with a custom output file:

```bash
npm run cli translate examples/simple.js -o output.sb3.json
```

### Web Interface

Start the web server:

```bash
npm start
```

Then open your browser to `http://localhost:3000`

The web interface allows you to:
- Drag and drop JavaScript files for translation
- Paste code directly into the editor
- Download the resulting Scratch project

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
window.alert("Hello!"); // ❌ Error: Unsupported feature
console.log(x);         // ❌ Error: Unsupported feature
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

## Development

The project uses:
- **acorn**: JavaScript parser
- **commander**: CLI framework
- **express**: Web server
- **multer**: File upload handling

## License

ISC
