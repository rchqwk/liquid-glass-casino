"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function CasinoDialog({ open, onClose, title, children, dismissible = true, showHeading = true }: { open: boolean; onClose: () => void; title: string; children: ReactNode; dismissible?: boolean; showHeading?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
  }, [open]);
  return (
    <dialog ref={dialog} className="casino-dialog" aria-labelledby={showHeading ? titleId : undefined} aria-label={showHeading ? undefined : title} onCancel={event => { if (!dismissible) event.preventDefault(); else onClose(); }} onClose={onClose}>
      {showHeading ? <div className="casino-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        {dismissible ? <button type="button" className="casino-button casino-secondary" onClick={onClose}>Close</button> : null}
      </div> : null}
      {children}
    </dialog>
  );
}
