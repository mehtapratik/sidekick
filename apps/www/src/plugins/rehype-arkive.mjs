// hast tweaks (SPEC 6): wide-table wrapper, the code figure with its Copy button, and wide display math.
import { SKIP, visit } from 'unist-util-visit';

const LABELS = {
   'ts': 'TypeScript',
   'typescript': 'TypeScript',
   'tsx': 'TSX',
   'js': 'JavaScript',
   'javascript': 'JavaScript',
   'jsx': 'JSX',
   'json': 'JSON',
   'jsonc': 'JSON',
   'bash': 'Shell',
   'sh': 'Shell',
   'shell': 'Shell',
   'shellscript': 'Shell',
   'zsh': 'Shell',
   'sql': 'SQL',
   'yaml': 'YAML',
   'yml': 'YAML',
   'md': 'Markdown',
   'markdown': 'Markdown',
   'css': 'CSS',
   'html': 'HTML',
   'plaintext': 'Code',
   'text': 'Code',
   'txt': 'Code',
   '': 'Code',
};
const label = (lang) =>
   LABELS[lang] ?? (lang ? lang[0].toUpperCase() + lang.slice(1) : 'Code');

const isLine = (n) =>
   n.type === 'element' &&
   n.tagName === 'span' &&
   []
      .concat(n.properties?.class ?? n.properties?.className ?? [])
      .join(' ')
      .split(' ')
      .includes('line');

const textOf = (n) =>
   n.type === 'text' ? n.value : (n.children ?? []).map(textOf).join('');

/**
 * What a diff line is, from its first characters. `---` and `+++` are file headers only before
 * the first hunk; inside a hunk they are a removed `--` line or an added `++` line.
 */
function diffLineKinds(lines) {
   let inHunk = false;
   return lines.map((text) => {
      if (text.startsWith('@@')) {
         inHunk = true;
         return 'hunk';
      }
      if (text.startsWith('diff ')) inHunk = false;
      if (!inHunk && /^(diff |index |--- |\+\+\+ )/.test(text)) return 'hunk';
      if (text.startsWith('+')) return 'ins';
      if (text.startsWith('-')) return 'del';
      return undefined;
   });
}

const DIFF_TAGS = { ins: 'ins', del: 'del', hunk: 'span' };

/**
 * Diff blocks: an added line becomes <ins>, a removed line <del> and a hunk or file header
 * <span class="hunk">, each holding the plain line text; arkive.css colours them. Context lines
 * stay as Shiki's tokens. The plain text also drops the `user-select: none` span Astro puts
 * around the +/- marker, so a selection copies the patch as written, as the Copy button does.
 */
function diffLines(children) {
   const kinds = diffLineKinds(children.filter(isLine).map(textOf));
   let line = 0;
   return children.map((c) => {
      const kind = isLine(c) ? kinds[line++] : undefined;
      if (!kind) return c;
      return {
         type: 'element',
         tagName: DIFF_TAGS[kind],
         properties: kind === 'hunk' ? { className: ['hunk'] } : {},
         children: [{ type: 'text', value: textOf(c) }],
      };
   });
}

/**
 * Shiki transformer: the <pre> carries only `data-language` (the page's own text colour and
 * borders come from arkive.css), and per-line wrapper spans are flattened away, except the
 * added, removed and header lines of a diff block (see `diffLines`).
 */
export const shikiArkive = {
   name: 'arkive',
   pre(node) {
      node.properties = { 'data-language': this.options.lang ?? '' };
   },
   code(node) {
      const children =
         this.options.lang === 'diff'
            ? diffLines(node.children)
            : node.children;
      node.children = children.flatMap((c) => (isLine(c) ? c.children : [c]));
   },
};

/** Rehype plugin: wraps wide tables, builds the code figure with its Copy button, and wraps display math */
export function rehypeArkive() {
   return (tree) => {
      visit(tree, 'element', (node, index, parent) => {
         if (!parent || index == null) return;

         // Display math is MathML, which cannot scroll by itself. Give it the same
         // "may leave the column, then scroll" wrapper as a wide table; arkive.css already has it.
         const isDisplayMath =
            node.tagName === 'span' &&
            [].concat(node.properties?.className ?? []).includes('katex') &&
            node.children.some(
               (c) => c.tagName === 'math' && c.properties?.display === 'block',
            );

         if (node.tagName === 'table' || isDisplayMath) {
            parent.children[index] = {
               type: 'element',
               tagName: 'div',
               properties: {
                  className:
                     node.tagName === 'table'
                        ? ['wide', 'wide-table']
                        : ['wide'],
               },
               children: [node],
            };
            return [SKIP, index + 1];
         }

         const lang =
            node.properties?.['data-language'] ?? node.properties?.dataLanguage;
         if (node.tagName === 'pre' && lang !== undefined) {
            parent.children[index] = {
               type: 'element',
               tagName: 'figure',
               properties: { className: ['code'] },
               children: [
                  {
                     type: 'element',
                     tagName: 'div',
                     properties: { className: ['code-head'] },
                     children: [
                        {
                           type: 'element',
                           tagName: 'span',
                           properties: { className: ['muted'] },
                           children: [
                              { type: 'text', value: label(String(lang)) },
                           ],
                        },
                        {
                           type: 'element',
                           tagName: 'button',
                           properties: {
                              'type': 'button',
                              'data-copy': '',
                              'hidden': true,
                           },
                           children: [{ type: 'text', value: 'Copy' }],
                        },
                     ],
                  },
                  node,
               ],
            };
            return [SKIP, index + 1];
         }
      });
   };
}
