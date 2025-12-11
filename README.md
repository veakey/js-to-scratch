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

The CLI allows you to translate JavaScript files, HTML files with canvas, or zip archives containing JavaScript projects.

#### Translate a single JavaScript file:

```bash
npm run cli -- translate examples/simple.js
```

This will generate a `.sb3` file in the same directory as the input file.

#### Translate an HTML file with canvas:

```bash
npm run cli -- translate examples/canvas-hello.html -o output.sb3
```

The translator will extract JavaScript from `<script>` tags and automatically convert canvas drawing operations to Scratch blocks.

#### Translate with a custom output file:

```bash
npm run cli -- translate examples/simple.js -o output.sb3
```

#### Translate a zip archive:

You can also provide a zip file containing JavaScript, CSS, and HTML files. JavaScript will be extracted from both `.js` files and `<script>` tags in `.html` files.

```bash
npm run cli -- translate project.zip -o output.sb3
```

**Requirements for zip files:**
- The zip file must contain `.js`, `.css`, and/or `.html` files in the root directory
- All JavaScript files will be combined and translated
- JavaScript will be extracted from HTML `<script>` tags
- CSS files will be ignored but are allowed in the archive

### Web Interface (UI)

The web interface provides a user-friendly way to translate your code with drag-and-drop support.

#### Start the web server:

```bash
npm start
```

Then open your browser to `http://localhost:3000`

#### Features:

- **Drag and drop** JavaScript files (`.js`), HTML files (`.html`), or zip archives (`.zip`) for translation
- **Click to browse** files from your computer
- **Paste code directly** into the editor for quick translations
- **Automatic download** of the resulting Scratch project as a `.sb3` file
- **File size limit**: 10MB for uploads
- **Supported formats**: 
  - `.js` JavaScript files
  - `.html` HTML files with canvas (JavaScript extracted from `<script>` tags)
  - `.zip` archives containing `.js`, `.html`, `.css` files

#### Usage instructions:

1. Either drag & drop a file onto the drop zone, or click "Choose File" to browse
2. For zip files: ensure they contain at least one JavaScript file in the root
3. The translation happens automatically upon file upload
4. Download the generated `.sb3` file
5. Upload the `.sb3` file to https://scratch.mit.edu/ to view your project

## Supported JavaScript Features

The translator supports a subset of JavaScript features that can be mapped to Scratch blocks:

- **Variables** (`let`, `const`, `var`)
- **Arithmetic operations** (`+`, `-`, `*`, `/`)
- **Comparison operators** (`<`, `>`, `==`, `===`, `!=`, `!==`, `<=`, `>=`)
- **Unary operators** (`!` - logical not)
- **Control structures**:
  - `if` statements
  - `while` loops
  - `for` loops (simple and complex patterns)
- **Functions**:
  - Arrow functions: `const f = (a, b) => a + b`
  - Function declarations: `function f(a, b) { return a + b; }`
  - Function calls with parameter substitution
  - **Recursive functions** (detected automatically and converted to Scratch procedures)
- **Arrays/Lists**:
  - Array literals: `[1, 2, 3]`
  - Array access: `arr[i]`, `arr.length`
  - Array methods: `arr.push(x)`, `arr.pop()`
  - Array assignment: `arr[i] = value`
- **Objects** (simple):
  - Object literals: `{a: 1, b: 2}`
  - Property access: `obj.prop`, `obj['prop']`
  - Property assignment: `obj.prop = value`
  - Objects are flattened to variables: `obj.prop` → `obj_prop`

### HTML Canvas Support

The translator can extract JavaScript from HTML files and automatically transform canvas drawing operations:

- **HTML Parsing**: Extracts JavaScript from `<script>` tags in HTML files
- **Canvas API Transformation**: Converts canvas 2D context operations to Scratch equivalents:
  - **Text operations**:
    - `ctx.fillText()` → Scratch "say" block
    - `ctx.strokeText()` → Scratch "say" block
  - **Styles**:
    - `ctx.fillStyle` → `scratch_pen_color` variable
    - `ctx.strokeStyle` → `scratch_stroke_color` variable
    - `ctx.font` (size) → `scratch_text_size` variable
    - `ctx.lineWidth` → `scratch_line_width` variable
  - **Shapes**:
    - `ctx.fillRect(x, y, w, h)` → Approximation with scratch_say
    - `ctx.strokeRect(x, y, w, h)` → Approximation with scratch_say
    - `ctx.arc(x, y, radius, ...)` → Approximation with scratch_say
  - **Paths**:
    - `ctx.beginPath()`, `ctx.moveTo()`, `ctx.lineTo()`, `ctx.stroke()`, `ctx.fill()` → Supported (operations tracked)
  - Canvas context initialization (`document.getElementById`, `getContext`) is automatically handled

**Example:**
```javascript
// This canvas code:
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
ctx.font = '30px Arial';
ctx.fillStyle = 'black';
ctx.fillText('Hello world', 200, 100);

// Is transformed to:
scratch_text_size = 30;
scratch_pen_color = 'black';
scratch_say('Hello world', 200, 100);
```

## Unsupported Features

The following JavaScript features are **not supported** in Scratch and will throw visible exceptions:

- ❌ `window.location`
- ❌ `window.alert`
- ❌ `window.confirm`
- ❌ `window.prompt`
- ❌ `console.log`
- ❌ `localStorage`
- ❌ `sessionStorage`
- ❌ `fetch`
- ❌ `XMLHttpRequest`
- ❌ `setTimeout`
- ❌ `setInterval`
- ❌ `Promise`
- ❌ `async`/`await`

**Note:** When translating HTML files, `document.getElementById()` and canvas `getContext()` are automatically handled and transformed, so they won't cause errors in that context.

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

for (let i = 0; i < 5; i++) {
    y = y + i;
}
```

This code will be successfully translated to Scratch blocks with proper for loop handling.

### Example 2: HTML Canvas (Supported)

```html
<!DOCTYPE html>
<html>
<body>
  <canvas id="myCanvas" width="400" height="200"></canvas>
  <script>
    const canvas = document.getElementById('myCanvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '30px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText('Hello world', 200, 100);
  </script>
</body>
</html>
```

This HTML file with canvas will be successfully translated. The canvas operations are automatically converted to Scratch blocks.

### Example 3: Unsupported Features

```javascript
let x = 10;
window.alert("Hello!"); // ✗ Error: Unsupported feature
console.log(x);         // ✗ Error: Unsupported feature
```

This code will throw visible exceptions indicating which features are not supported.

### Example 4: Arrays and Objects (Supported)

```javascript
let arr = [1, 2, 3];
let x = arr[0];
arr.push(4);
arr[1] = 10;

let obj = {a: 1, b: 2};
let y = obj.a;
obj.b = 20;
```

Arrays are converted to Scratch lists, and objects are flattened to variables (e.g., `obj.a` → `obj_a`).

### Example 5: Recursive Functions (Supported)

```javascript
function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

let result = factorial(5);
```

Recursive functions are automatically detected and converted to Scratch procedures blocks.

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
