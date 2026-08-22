import { useEffect, useRef } from "react";

/** Controlled native <dialog>: focus trap + Escape handling come free. */
export function Dialog({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby={labelledBy}>
      {children}
    </dialog>
  );
}

export function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`pill ${active ? "pill-active" : "pill-draft"}`}>
      <span className="pill-dot" aria-hidden />
      {active ? "Active" : "Draft"}
    </span>
  );
}
