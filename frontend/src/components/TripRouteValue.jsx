import { useLayoutEffect, useRef } from 'react';

export default function TripRouteValue({ origin, destination }) {
  const container = useRef(null);
  const content = useRef(null);
  const route = `${origin} → ${destination}`;
  useLayoutEffect(() => {
    let disposed = false;
    const fit = () => {
      const box = container.current, text = content.current;
      if (!box || !text || !box.clientWidth) return;
      const style = getComputedStyle(box);
      const available = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const scale = Math.min(1, Math.max(0, (available - 1) / Math.max(1, text.scrollWidth)));
      text.style.transform = `scale(${scale})`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container.current);
    observer.observe(content.current);
    document.fonts?.ready.then(() => { if (!disposed) fit(); });
    return () => { disposed = true; observer.disconnect(); };
  }, [route]);
  return <dd ref={container} className="gv-badge-mono gv-trip-route" title={route}>
    <span ref={content} className="gv-trip-route-text">{route}</span>
  </dd>;
}
