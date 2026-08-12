interface ScrollLockDocument {
  body: {
    style: {
      overflow: string;
    };
  };
}

interface ScrollLockState {
  count: number;
  originalOverflow: string;
}

const activeLocks = new WeakMap<object, ScrollLockState>();

/**
 * Acquires a reference-counted page scroll lock and returns an idempotent
 * release function. The first acquisition owns restoration of the exact body
 * overflow value that existed before any Articol dialog opened.
 */
export function acquirePageScrollLock(documentLike: ScrollLockDocument): () => void {
  const lockTarget = documentLike.body as object;
  let state = activeLocks.get(lockTarget);

  if (!state) {
    state = {
      count: 0,
      originalOverflow: documentLike.body.style.overflow,
    };
    activeLocks.set(lockTarget, state);
    documentLike.body.style.overflow = 'hidden';
  }

  state.count += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    state!.count -= 1;

    if (state!.count === 0) {
      documentLike.body.style.overflow = state!.originalOverflow;
      activeLocks.delete(lockTarget);
    }
  };
}
