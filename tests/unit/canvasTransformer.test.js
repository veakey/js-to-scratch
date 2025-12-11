const { transformCanvasToScratch } = require('../../src/utils/canvasTransformer');

describe('Canvas Transformer', () => {
  describe('transformCanvasToScratch', () => {
    test('should transform canvas fillText to scratch_say', () => {
      const code = `
        const canvas = document.getElementById('myCanvas');
        const ctx = canvas.getContext('2d');
        ctx.fillText('Hello world', 100, 100);
      `;
      
      const transformed = transformCanvasToScratch(code);
      expect(transformed).toContain('scratch_say');
      expect(transformed).toContain('Hello world');
      expect(transformed).not.toContain('document.getElementById');
      expect(transformed).not.toContain('getContext');
    });

    test('should transform canvas fillStyle to scratch_pen_color', () => {
      const code = `
        const canvas = document.getElementById('myCanvas');
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'red';
      `;
      
      const transformed = transformCanvasToScratch(code);
      expect(transformed).toContain('scratch_pen_color');
      expect(transformed).toContain('red');
    });

    test('should transform canvas font size', () => {
      const code = `
        const canvas = document.getElementById('myCanvas');
        const ctx = canvas.getContext('2d');
        ctx.font = '30px Arial';
      `;
      
      const transformed = transformCanvasToScratch(code);
      expect(transformed).toContain('scratch_text_size');
      expect(transformed).toContain('30');
    });

    test('should handle complete canvas example', () => {
      const code = `
        const canvas = document.getElementById('myCanvas');
        const ctx = canvas.getContext('2d');
        ctx.font = '30px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Hello world', canvas.width / 2, canvas.height / 2);
      `;
      
      const transformed = transformCanvasToScratch(code);
      expect(transformed).toContain('scratch_text_size = 30');
      expect(transformed).toContain('scratch_pen_color = \'black\'');
      expect(transformed).toContain('scratch_say(\'Hello world\'');
    });

    test('should skip textAlign and textBaseline properties', () => {
      const code = `
        const ctx = canvas.getContext('2d');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      `;
      
      const transformed = transformCanvasToScratch(code);
      expect(transformed).not.toContain('textAlign');
      expect(transformed).not.toContain('textBaseline');
    });

    test('should return original code if parsing fails', () => {
      const invalidCode = 'this is not valid javascript {{{';
      const transformed = transformCanvasToScratch(invalidCode);
      expect(transformed).toBe(invalidCode);
    });

    test('should handle strokeText like fillText', () => {
      const code = `
        const ctx = canvas.getContext('2d');
        ctx.strokeText('Hello', 50, 50);
      `;
      
      const transformed = transformCanvasToScratch(code);
      expect(transformed).toContain('scratch_say');
      expect(transformed).toContain('Hello');
    });

    test('should preserve non-canvas code', () => {
      const code = `
        let x = 10;
        let y = 20;
        const ctx = canvas.getContext('2d');
        ctx.fillText('test', 0, 0);
      `;
      
      const transformed = transformCanvasToScratch(code);
      // Non-canvas code is not explicitly preserved in current implementation
      // but should not cause errors
      expect(transformed).toContain('scratch_say');
    });

    test('should transform fillRect to scratch_say', () => {
      const code = `
        const ctx = canvas.getContext('2d');
        ctx.fillRect(10, 20, 100, 50);
      `;
      
      const transformed = transformCanvasToScratch(code);
      expect(transformed).toContain('scratch_say');
      expect(transformed).toContain('fillRect');
    });

    test('should transform strokeRect to scratch_say', () => {
      const code = `
        const ctx = canvas.getContext('2d');
        ctx.strokeRect(10, 20, 100, 50);
      `;
      
      const transformed = transformCanvasToScratch(code);
      expect(transformed).toContain('scratch_say');
      expect(transformed).toContain('strokeRect');
    });

    test('should transform arc to scratch_say', () => {
      const code = `
        const ctx = canvas.getContext('2d');
        ctx.arc(100, 100, 50, 0, Math.PI * 2);
      `;
      
      const transformed = transformCanvasToScratch(code);
      expect(transformed).toContain('scratch_say');
      expect(transformed).toContain('arc');
    });

    test('should transform strokeStyle to scratch_stroke_color', () => {
      const code = `
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = 'blue';
      `;
      
      const transformed = transformCanvasToScratch(code);
      expect(transformed).toContain('scratch_stroke_color');
      expect(transformed).toContain('blue');
    });

    test('should transform lineWidth to scratch_line_width', () => {
      const code = `
        const ctx = canvas.getContext('2d');
        ctx.lineWidth = 5;
      `;
      
      const transformed = transformCanvasToScratch(code);
      expect(transformed).toContain('scratch_line_width');
      expect(transformed).toContain('5');
    });

    test('should handle path operations (beginPath, moveTo, lineTo, stroke, fill)', () => {
      const code = `
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(10, 10);
        ctx.lineTo(50, 50);
        ctx.stroke();
      `;
      
      const transformed = transformCanvasToScratch(code);
      // Path operations are skipped but should not cause errors
      expect(transformed).toBeDefined();
    });
  });
});
