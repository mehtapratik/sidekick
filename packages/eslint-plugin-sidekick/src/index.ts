import { noBarrelExports } from './rules/no-barrel-exports';
import { noDefaultExport } from './rules/no-default-export';
import { noInlineStyles } from './rules/no-inline-styles';
import { noMantineStyleProps } from './rules/no-mantine-style-props';
import { requireApiGuard } from './rules/require-api-guard';
import { requireUserLock } from './rules/require-user-lock';

export default {
   rules: {
      'no-barrel-exports': noBarrelExports,
      'no-default-export': noDefaultExport,
      'no-inline-styles': noInlineStyles,
      'no-mantine-style-props': noMantineStyleProps,
      'require-api-guard': requireApiGuard,
      'require-user-lock': requireUserLock,
   },
};
