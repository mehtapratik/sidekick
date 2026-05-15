import { ReactNode } from 'react';

import styles from './layout.module.css';

export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: ReactNode }): React.ReactElement {
  return <main className={styles.root}>{children}</main>;
}
