import type { ReactNode } from "react";

export type MobileDrawerProps = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;

  onDrawerPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onDrawerPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onDrawerPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onDrawerPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
};

export function MobileDrawer(props: MobileDrawerProps) {
  const { open, onOpen, onClose, children, onDrawerPointerDown, onDrawerPointerMove, onDrawerPointerUp, onDrawerPointerCancel } = props;

  return (
    <>
      {/* Backdrop */}
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40"
          aria-label="Close menu"
          onClick={onClose}
        />
      ) : null}

      {/* Drawer */}
      <aside
        className="fixed top-0 left-0 z-50 h-full bg-white border-r border-slate-200 shadow-xl flex flex-col"
        style={{
          width: "min(88vw, 420px)",
          transform: open ? "translateX(0)" : "translateX(-110%)",
          transition: "transform 200ms ease",
        }}
        onPointerDown={onDrawerPointerDown}
        onPointerMove={onDrawerPointerMove}
        onPointerUp={onDrawerPointerUp}
        onPointerCancel={onDrawerPointerCancel}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200">
          <div className="text-sm font-semibold text-slate-900">Menu</div>
          <button
            type="button"
            className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-700 text-sm shadow-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch" as any }}
        >
          {children}
          <div className="pb-[env(safe-area-inset-bottom)]" />
        </div>
      </aside>
    </>
  );
}

