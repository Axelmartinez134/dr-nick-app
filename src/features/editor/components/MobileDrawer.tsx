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
      {/* Open handle */}
      {!open ? (
        <button
          type="button"
          className="fixed left-2 top-24 z-40 h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm text-slate-700"
          onClick={onOpen}
          aria-label="Open menu"
          title="Open menu"
        >
          ☰
        </button>
      ) : null}

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
        className="fixed top-0 left-0 z-50 h-full bg-white border-r border-slate-200 shadow-xl"
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
        {children}
      </aside>
    </>
  );
}

