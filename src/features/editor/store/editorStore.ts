import type { EditorState, EditorStore } from "./types";

export function createEditorStore(initialState?: EditorState): EditorStore {
  let state: EditorState = initialState as EditorState;
  const listeners = new Set<() => void>();

  const getState = () => state;

  const setState: EditorStore["setState"] = (updater) => {
    const patch = typeof updater === "function" ? (updater as (prev: EditorState) => Partial<EditorState>)(state) : updater;
    // Always notify for now; Phase 2 will introduce slice/equality usage.
    state = { ...state, ...(patch as Partial<EditorState>) };
    for (const l of listeners) l();
  };

  const subscribe: EditorStore["subscribe"] = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return { getState, setState, subscribe };
}

