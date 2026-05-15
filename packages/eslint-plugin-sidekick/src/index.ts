import { noBarrelExports } from './rules/no-barrel-exports';
import { noDefaultExport } from './rules/no-default-export';
import { noInlineStyles } from './rules/no-inline-styles';
import { noMantineStyleProps } from './rules/no-mantine-style-props';

export default {
  rules: {
    'no-barrel-exports': noBarrelExports,
    'no-default-export': noDefaultExport,
    'no-inline-styles': noInlineStyles,
    'no-mantine-style-props': noMantineStyleProps,
  },
};
