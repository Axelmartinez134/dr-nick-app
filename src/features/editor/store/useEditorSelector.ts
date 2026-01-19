import { useCallback, useSyncExternalStore } from "react";
import { useEditorStore } from "./EditorStoreProvider";
import type { EditorState } from "./types";

export function useEditorSelector<T>(selector: (state: EditorState) => T): T {
  const store = useEditorStore();

  const getSnapshot = useCallback(() => selector(store.getState()), [selector, store]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

