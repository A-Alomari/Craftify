'use strict';
/**
 * v05-notification-style.suite.js
 * Static analysis: verifies that NO EJS view file uses native browser
 * alert() / confirm() / window.alert() / window.confirm() calls.
 * All dialogs must go through the project's custom notification system:
 *   - showToast(msg, type)   — for informational toasts
 *   - showConfirm(msg, cb)   — for confirmation dialogs (via main.js)
 *   - data-confirm="…"      — on <form> elements (intercepted by main.js)
 */

const fs   = require('fs');
const path = require('path');

// Patterns that must NOT appear in any .ejs file
const BANNED_PATTERNS = [
  { re: /\balert\s*\(/g,          label: 'alert(' },
  { re: /\bconfirm\s*\(/g,        label: 'confirm(' },
  { re: /window\.alert\s*\(/g,    label: 'window.alert(' },
  { re: /window\.confirm\s*\(/g,  label: 'window.confirm(' },
];

// These occurrences are the *allowed* implementations inside main.js / form-loading.js;
// we only scan views/ here so no allowlist is needed.
const VIEWS_DIR = path.resolve(__dirname, '../../views');

/** Recursively collect all *.ejs files under dir */
function collectEjs(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectEjs(full, results);
    } else if (entry.isFile() && entry.name.endsWith('.ejs')) {
      results.push(full);
    }
  }
  return results;
}

module.exports = (_suiteContext) => {
  describe('Notification style compliance (no native alert/confirm in views)', () => {

    const ejsFiles = collectEjs(VIEWS_DIR);

    test('EJS view files exist for analysis', () => {
      expect(ejsFiles.length).toBeGreaterThan(0);
    });

    for (const { re, label } of BANNED_PATTERNS) {
      describe(`No bare "${label}" in any view`, () => {
        for (const filePath of ejsFiles) {
          const rel = path.relative(VIEWS_DIR, filePath);

          test(`views/${rel} must not use ${label}`, () => {
            const src = fs.readFileSync(filePath, 'utf8');
            // Reset the regex state before each test
            re.lastIndex = 0;
            const match = re.exec(src);
            if (match) {
              // Find the line number for a helpful failure message
              const lineNo = src.slice(0, match.index).split('\n').length;
              throw new Error(
                `Found "${label}" at line ${lineNo} in views/${rel}.\n` +
                `Use showToast(), showConfirm(), or data-confirm="…" instead.`
              );
            }
            expect(match).toBeNull();
          });
        }
      });
    }

    test('footer.ejs uses showToast for clipboard copy notification', () => {
      const footerPath = path.join(VIEWS_DIR, 'partials', 'footer.ejs');
      const src = fs.readFileSync(footerPath, 'utf8');
      expect(src).toContain('showToast');
    });

    test('main.js defines showConfirm', () => {
      const mainJs = path.resolve(__dirname, '../../public/js/main.js');
      const src = fs.readFileSync(mainJs, 'utf8');
      expect(src).toContain('showConfirm');
    });

    test('main.js defines showToast', () => {
      const mainJs = path.resolve(__dirname, '../../public/js/main.js');
      const src = fs.readFileSync(mainJs, 'utf8');
      expect(src).toContain('showToast');
    });

    test('main.js intercepts data-confirm forms', () => {
      const mainJs = path.resolve(__dirname, '../../public/js/main.js');
      const src = fs.readFileSync(mainJs, 'utf8');
      expect(src).toContain('data-confirm');
    });

    test('form-loading.js does not show Processing text or spinner', () => {
      const flPath = path.resolve(__dirname, '../../public/js/form-loading.js');
      const src = fs.readFileSync(flPath, 'utf8');
      expect(src).not.toContain('Processing');
      expect(src).not.toContain('spinner');
    });

  });
};
