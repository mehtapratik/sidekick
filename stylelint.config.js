/** @type {import('stylelint').Config} */
export default {
  rules: {
    // CSS module class names must be camelCase.
    //
    // Rationale: CSS modules are accessed in TypeScript as `styles.className`.
    // Kebab-case names (`my-class`) require bracket notation (`styles['my-class']`)
    // which bypasses TypeScript's property lookup and defeats type safety.
    // camelCase names work as plain property access (`styles.myClass`) and are
    // consistent with TypeScript naming conventions.
    //
    // Pattern: starts with a lowercase letter, followed by letters and digits only.
    // ✓ myClass  ✓ headerInner  ✓ brandName2
    // ✗ MyClass  ✗ my-class     ✗ my_class
    'selector-class-pattern': [
      '^[a-z][a-zA-Z0-9]*$',
      {
        message: (selector) =>
          `Class name "${selector}" must be camelCase (e.g. myClass, not my-class or MyClass).`,
      },
    ],
  },
};
