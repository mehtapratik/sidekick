import { ReactNode } from 'react';

import styles from './layout.module.css';

export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className={styles.root}>{children}</main>;
}
