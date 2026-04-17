import { useEffect, useState } from 'react';

const KEY = 'vision-recently-viewed';
const MAX = 8;

export function useRecentlyViewed(currentHandle: string | undefined) {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const stored: string[] = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    setRecent(stored.filter(h => h !== currentHandle));

    if (currentHandle) {
      const updated = [currentHandle, ...stored.filter(h => h !== currentHandle)].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(updated));
    }
  }, [currentHandle]);

  return recent;
}
