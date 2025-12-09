const { extractJavaScriptFromHTML, isHTML } = require('../../src/utils/htmlParser');

describe('HTML Parser', () => {
  describe('extractJavaScriptFromHTML', () => {
    test('should extract JavaScript from single script tag', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
          <script>
            let x = 10;
            let y = 20;
          </script>
        </body>
        </html>
      `;
      
      const js = extractJavaScriptFromHTML(html);
      expect(js).toContain('let x = 10');
      expect(js).toContain('let y = 20');
    });

    test('should extract JavaScript from multiple script tags', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script>let a = 1;</script>
        </head>
        <body>
          <script>let b = 2;</script>
        </body>
        </html>
      `;
      
      const js = extractJavaScriptFromHTML(html);
      expect(js).toContain('let a = 1');
      expect(js).toContain('let b = 2');
    });

    test('should extract canvas code', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <canvas id="myCanvas"></canvas>
          <script>
            const canvas = document.getElementById('myCanvas');
            const ctx = canvas.getContext('2d');
            ctx.fillText('Hello world', 100, 100);
          </script>
        </body>
        </html>
      `;
      
      const js = extractJavaScriptFromHTML(html);
      expect(js).toContain('document.getElementById');
      expect(js).toContain('getContext');
      expect(js).toContain('fillText');
    });

    test('should handle empty script tags', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <script></script>
          <script>   </script>
          <script>let x = 5;</script>
        </body>
        </html>
      `;
      
      const js = extractJavaScriptFromHTML(html);
      expect(js).toContain('let x = 5');
      expect(js).not.toContain('<script>');
    });

    test('should return empty string for HTML with no scripts', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <h1>Hello World</h1>
        </body>
        </html>
      `;
      
      const js = extractJavaScriptFromHTML(html);
      expect(js).toBe('');
    });

    test('should handle script tags with attributes', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <script type="text/javascript">
            let value = 42;
          </script>
        </body>
        </html>
      `;
      
      const js = extractJavaScriptFromHTML(html);
      expect(js).toContain('let value = 42');
    });
  });

  describe('isHTML', () => {
    test('should detect HTML with DOCTYPE', () => {
      const content = '<!DOCTYPE html><html></html>';
      expect(isHTML(content)).toBe(true);
    });

    test('should detect HTML with DOCTYPE (case insensitive)', () => {
      const content = '<!doctype html><html></html>';
      expect(isHTML(content)).toBe(true);
    });

    test('should detect HTML starting with <html', () => {
      const content = '<html><body></body></html>';
      expect(isHTML(content)).toBe(true);
    });

    test('should not detect JavaScript as HTML', () => {
      const content = 'let x = 10;';
      expect(isHTML(content)).toBe(false);
    });

    test('should handle whitespace', () => {
      const content = '   <!DOCTYPE html><html></html>';
      expect(isHTML(content)).toBe(true);
    });
  });
});
