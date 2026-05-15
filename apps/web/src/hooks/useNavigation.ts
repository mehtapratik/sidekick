'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

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
