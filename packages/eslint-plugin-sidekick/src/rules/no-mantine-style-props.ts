import type { Rule } from 'eslint';
import type * as ESTree from 'estree';
import type { JSXAttribute, JSXIdentifier, JSXMemberExpression, JSXOpeningElement } from 'estree-jsx';

/**
 * When `AppShell` is imported from `@mantine/core`, subcomponents are often used as
 * `<AppShell.Header />` or as bare `<Header />`. Track these names so style props on the
 * latter are still flagged.
 */
const MANTINE_COMPOUND_SUBBINDINGS: Readonly<Record<string, readonly string[]>> = {
  AppShell: ['Header', 'Navbar', 'Aside', 'Footer', 'Section', 'Main'],
};

function importedSpecifierName(specifier: ESTree.ImportSpecifier): string | null {
  if (specifier.imported.type === 'Identifier') {
    return specifier.imported.name;
  }
  if (specifier.imported.type === 'Literal' && typeof specifier.imported.value === 'string') {
    return specifier.imported.value;
  }
  return null;
}

/**
 * Step 3: from JSXOpeningElement.name
 * - JSXIdentifier: elementName.name (e.g. `Header`, `Text`)
 * - JSXMemberExpression: left-most name on `object` (e.g. `AppShell.Header` → `AppShell`,
 *   `MantineAppShell.Header` → `MantineAppShell`). Matches `elementName.object.name` when
 *   `object` is a JSXIdentifier; otherwise walks nested `object` until a JSXIdentifier.
 */
function mantineComponentKeyFromElementName(elementName: JSXOpeningElement['name']): string | null {
  if (elementName.type === 'JSXIdentifier') {
    return elementName.name;
  }
  if (elementName.type === 'JSXMemberExpression') {
    let obj: JSXIdentifier | JSXMemberExpression = elementName.object;
    while (obj.type === 'JSXMemberExpression') {
      obj = obj.object;
    }
    return obj.name;
  }
  return null;
}

const MANTINE_STYLE_PROPS = new Set([
  // Spacing
  'p',
  'px',
  'py',
  'pt',
  'pb',
  'pl',
  'pr',
  'm',
  'mx',
  'my',
  'mt',
  'mb',
  'ml',
  'mr',
  // Sizing
  'w',
  'h',
  'maw',
  'mah',
  'miw',
  'mih',
  // Typography
  'ta',
  'fw',
  'fz',
  'ff',
  'fs',
  'lh',
  'lts',
  'bdi',
  // Color
  'c',
  'bg',
  'opacity',
  // Layout
  'pos',
  'top',
  'left',
  'right',
  'bottom',
  // Border
  'bd',
  // Flex/Grid shortcuts (on layout components)
  'justify',
  'align',
  'gap',
  'wrap',
  'grow',
  // Old-style aliases still in Mantine
  'color',
  'size',
  // CSS-in-JS escape hatch — banned alongside inline styles
  'sx',
]);

export const noMantineStyleProps: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow Mantine style props - use CSS modules instead.',
    },
    messages: {
      noMantineStyleProps:
        'Mantine style prop "{{ prop }}" is not allowed. Use a CSS module class instead.',
    },
    schema: [],
  },
  create(context) {
    const mantineComponents = new Set<string>();

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration & { parent: ESTree.Node }) {
        if (node.source.value !== '@mantine/core') {
          return;
        }
        for (const specifier of node.specifiers) {
          mantineComponents.add(specifier.local.name);
          if (specifier.type === 'ImportSpecifier') {
            const importedName = importedSpecifierName(specifier);
            if (importedName) {
              const extras = MANTINE_COMPOUND_SUBBINDINGS[importedName];
              if (extras) {
                for (const extra of extras) {
                  mantineComponents.add(extra);
                }
              }
            }
          }
        }
      },

      JSXAttribute(node: JSXAttribute & { parent: ESTree.Node }) {
        // 1. Attribute name (node.name is JSXIdentifier)
        if (node.name.type !== 'JSXIdentifier') {
          return;
        }
        const attrName = node.name.name;

        // 2. Mantine style prop?
        if (!MANTINE_STYLE_PROPS.has(attrName)) {
          return;
        }

        const opening = node.parent;
        if (opening.type !== 'JSXOpeningElement') {
          return;
        }

        // 3. opening.name → JSXIdentifier vs JSXMemberExpression (see mantineComponentKeyFromElementName)
        const elementName = opening.name;
        const componentKey = mantineComponentKeyFromElementName(elementName);
        if (componentKey === null) {
          return;
        }

        // 4–5. Bound Mantine component / compound slot?
        if (mantineComponents.has(componentKey)) {
          context.report({ node, messageId: 'noMantineStyleProps', data: { prop: attrName } });
        }
      },
    };
  },
};
