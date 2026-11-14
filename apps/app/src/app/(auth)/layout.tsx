import type { ReactNode } from 'react';

import styles from './layout.module.css';

/** Render on every request, never statically: auth pages read the session cookie */
export const dynamic = 'force-dynamic';

/** Layout for the sign-in and sign-up pages: centres them in a bare page */
export default function AuthLayout({
   children,
}: {
   children: ReactNode;
}): React.ReactElement {
   return <main className={styles.root}>{children}</main>;
}
