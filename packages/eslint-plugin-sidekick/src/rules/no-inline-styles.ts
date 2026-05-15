import type { Rule } from 'eslint';
import type { JSXAttribute } from 'estree-jsx';

/**
 * Disallows the `style` prop on any JSX element.
 *
 * Inline styles are the most direct way to bypass the CSS modules convention:
 * they are not co-located with other styles, cannot be linted for consistency,
 * and are harder to override in a structured way.
 *
 * Use CSS modules instead. For the rare case of CSS custom properties that
 * genuinely cannot be expressed as a static class (e.g. a dynamic colour value
 * passed from JS), add a targeted eslint-disable comment with a short
 * explanation so the exception is visible in code review.
 */
export const noInlineStyles: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow the style prop on JSX elements — use CSS modules instead.',
    },
    messages: {
      noInlineStyles:
        'Inline styles are not allowed. Use a CSS module class instead. ' +
        'If you need a dynamic CSS custom property, add an eslint-disable comment with a reason.',
    },
    schema: [],
  },
  create(context): Rule.RuleListener {
    return {
      JSXAttribute(node: JSXAttribute) {
        if (node.name.type === 'JSXIdentifier' && node.name.name === 'style') {
          context.report({ node, messageId: 'noInlineStyles' });
        }
      },
    };
  },
};
