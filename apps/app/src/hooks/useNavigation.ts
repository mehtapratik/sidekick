'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/** Navigation that also refreshes server data, so pages see the new session after sign-in or sign-out */
export function useNavigation(): { push: (path: string) => void } {
   const router = useRouter();

   const push = useCallback(
      (path: string) => {
         router.push(path);
         router.refresh();
      },
      [router],
   );

   return {
      push,
   };
}
