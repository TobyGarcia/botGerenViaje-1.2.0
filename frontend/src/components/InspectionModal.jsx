import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * A layer owned by document.body so it is not affected by the mini app's
 * layout, scroll position, or any ancestor that creates a stacking context.
 */
export default function InspectionModal({ children }) {
  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverflow = root.style.overflow;

    body.classList.add("inspection-modal-open");
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";

    return () => {
      body.classList.remove("inspection-modal-open");
      body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
    };
  }, []);

  return createPortal(
    <div className="inspection-modal-overlay" role="dialog" aria-modal="true" aria-label="Inspección vehicular">
      <div className="inspection-modal-card">{children}</div>
    </div>,
    document.body
  );
}
