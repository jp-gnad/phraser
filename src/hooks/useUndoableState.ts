import { useCallback, useState } from "react";

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useUndoableState<T>(initialState: T, limit = 100) {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const update = useCallback(
    (updater: T | ((current: T) => T)) => {
      setHistory((current) => {
        const next = typeof updater === "function"
          ? (updater as (value: T) => T)(current.present)
          : updater;
        if (Object.is(next, current.present)) return current;
        return {
          past: [...current.past, current.present].slice(-limit),
          present: next,
          future: [],
        };
      });
    },
    [limit],
  );

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      return {
        past: [...current.past, current.present].slice(-limit),
        present: next,
        future: current.future.slice(1),
      };
    });
  }, [limit]);

  const reset = useCallback((state: T) => {
    setHistory({ past: [], present: state, future: [] });
  }, []);

  return {
    state: history.present,
    update,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

