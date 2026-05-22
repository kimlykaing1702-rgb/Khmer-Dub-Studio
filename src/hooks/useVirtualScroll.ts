// src/hooks/useVirtualScroll.ts
// Virtual scrolling hook - renders only visible rows, making 800 lines feel like 10

import { useState, useEffect, useRef, useCallback } from 'react';

interface VirtualScrollOptions {
  itemCount: number;
  itemHeight: number | ((index: number) => number);
  containerHeight: number;
  overscan?: number; // extra items to render above/below viewport
}

interface VirtualScrollResult {
  virtualItems: { index: number; start: number; size: number }[];
  totalSize: number;
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  innerRef: React.RefObject<HTMLDivElement>;
}

export function useVirtualScroll({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 5,
}: VirtualScrollOptions): VirtualScrollResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Build cumulative offset array for variable heights
  const getItemSize = useCallback(
    (index: number) =>
      typeof itemHeight === 'function' ? itemHeight(index) : itemHeight,
    [itemHeight]
  );

  const offsets = useRef<number[]>([]);
  useEffect(() => {
    const arr: number[] = new Array(itemCount + 1);
    arr[0] = 0;
    for (let i = 0; i < itemCount; i++) {
      arr[i + 1] = arr[i] + getItemSize(i);
    }
    offsets.current = arr;
  }, [itemCount, getItemSize]);

  const totalSize = offsets.current[itemCount] ?? itemCount * (typeof itemHeight === 'number' ? itemHeight : 80);

  // Binary search: find first item whose bottom edge is >= scrollTop
  const findStart = (scroll: number) => {
    const arr = offsets.current;
    let lo = 0;
    let hi = itemCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid + 1] < scroll) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const virtualItems = (() => {
    if (itemCount === 0) return [];
    const startIndex = Math.max(0, findStart(scrollTop) - overscan);
    const endScrollTop = scrollTop + containerHeight;
    let endIndex = startIndex;
    while (endIndex < itemCount && (offsets.current[endIndex] ?? 0) < endScrollTop) {
      endIndex++;
    }
    endIndex = Math.min(itemCount - 1, endIndex + overscan);

    const items = [];
    for (let i = startIndex; i <= endIndex; i++) {
      items.push({
        index: i,
        start: offsets.current[i] ?? i * 80,
        size: getItemSize(i),
      });
    }
    return items;
  })();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const el = containerRef.current;
      if (!el) return;
      const offset = offsets.current[index] ?? index * 80;
      el.scrollTo({ top: offset, behavior });
    },
    []
  );

  return { virtualItems, totalSize, scrollToIndex, containerRef, innerRef };
}
