export function getLayoutLockedFromInput(inputSnap: any | null): boolean {
  try {
    const v = inputSnap && typeof inputSnap === 'object' ? (inputSnap as any).editor?.layoutLocked : undefined;
    return v === true;
  } catch {
    return false;
  }
}

export function withLayoutLockedInInput(inputSnap: any | null, locked: boolean) {
  const base = inputSnap && typeof inputSnap === 'object' ? inputSnap : {};
  const editor =
    (base as any).editor && typeof (base as any).editor === 'object' ? (base as any).editor : {};
  return { ...(base as any), editor: { ...(editor as any), layoutLocked: !!locked } };
}

export function getAutoRealignOnImageReleaseFromInput(inputSnap: any | null): boolean {
  try {
    const v =
      inputSnap && typeof inputSnap === 'object'
        ? (inputSnap as any).editor?.autoRealignOnImageRelease
        : undefined;
    return v === true;
  } catch {
    return false;
  }
}

export function withAutoRealignOnImageReleaseInInput(inputSnap: any | null, enabled: boolean) {
  const base = inputSnap && typeof inputSnap === 'object' ? inputSnap : {};
  const editor =
    (base as any).editor && typeof (base as any).editor === 'object' ? (base as any).editor : {};
  return { ...(base as any), editor: { ...(editor as any), autoRealignOnImageRelease: !!enabled } };
}

