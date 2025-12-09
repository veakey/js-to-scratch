const { translateToScratch } = require('../../src/translator');
const { transformCanvasToScratch } = require('../../src/utils/canvasTransformer');

describe('Canvas Text Visibility', () => {
  test('sprite should be invisible when canvas text operations are present', () => {
    const canvasCode = `
      const canvas = document.getElementById('myCanvas');
      const ctx = canvas.getContext('2d');
      ctx.font = '30px Arial';
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Hello world', canvas.width / 2, canvas.height / 2);
    `;
    
    // Transform canvas code
    const transformedCode = transformCanvasToScratch(canvasCode);
    
    // Translate to Scratch
    const result = translateToScratch(transformedCode);
    
    // Get the sprite (second target, first is stage)
    const sprite = result.project.targets[1];
    
    // Sprite should be invisible for canvas text operations
    expect(sprite.visible).toBe(false);
    expect(sprite.isStage).toBe(false);
    
    // Should have the say block
    const hasSayBlock = Object.values(sprite.blocks).some(
      block => block.opcode === 'looks_say'
    );
    expect(hasSayBlock).toBe(true);
  });

  test('sprite should be visible when no canvas text operations are present', () => {
    const normalCode = `
      let x = 10;
      let y = 20;
      if (x < y) {
        x = x + 1;
      }
    `;
    
    // Translate to Scratch
    const result = translateToScratch(normalCode);
    
    // Get the sprite (second target, first is stage)
    const sprite = result.project.targets[1];
    
    // Sprite should be visible for normal code
    expect(sprite.visible).toBe(true);
    expect(sprite.isStage).toBe(false);
  });

  test('sprite should be invisible even with other operations if canvas text is present', () => {
    const mixedCode = `
      let x = 10;
      scratch_say('Hello world', 100, 100);
      x = x + 1;
    `;
    
    // Translate to Scratch
    const result = translateToScratch(mixedCode);
    
    // Get the sprite (second target, first is stage)
    const sprite = result.project.targets[1];
    
    // Sprite should be invisible because scratch_say is present
    expect(sprite.visible).toBe(false);
  });
});
