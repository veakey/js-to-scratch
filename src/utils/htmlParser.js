/**
 * HTML Parser Utility
 * Extracts JavaScript code from HTML files
 */

/**
 * Extract JavaScript code from HTML <script> tags
 * @param {string} htmlContent - HTML content
 * @returns {string} - Combined JavaScript code from all script tags
 */
function extractJavaScriptFromHTML(htmlContent) {
  // Match script tags including malformed closing tags with spaces/attributes
  // Using [^<]* instead of \s* to match any characters except < before the >
  // This handles cases like </script >, </script\t\n>, etc.
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script[^<]*>/gi;
  const scripts = [];
  let match;

  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    const scriptContent = match[1].trim();
    if (scriptContent) {
      scripts.push(scriptContent);
    }
  }

  return scripts.join('\n\n');
}

/**
 * Check if content is HTML
 * @param {string} content - File content
 * @returns {boolean}
 */
function isHTML(content) {
  const trimmed = content.trim();
  return trimmed.toLowerCase().startsWith('<!doctype html') || 
         trimmed.toLowerCase().startsWith('<html');
}

module.exports = {
  extractJavaScriptFromHTML,
  isHTML,
};
