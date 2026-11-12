import { useLayoutEffect, useRef } from 'react';

export default function TripRouteValue({ origin, destination }) {
  const container = useRef(null);
  const route = `${origin} → ${destination}`;
  useLayoutEffect(() => {
    let disposed = false;
    const fit = () => {
      if (!container.current) return;
      for (const box of container.current.querySelectorAll('.gv-trip-route-name')) {
        const text = box.firstElementChild;
        if (!box.clientWidth) continue;
        const scale = Math.min(1, Math.max(0, (box.clientWidth - 1) / Math.max(1, text.scrollWidth)));
        text.style.transform = `scale(${scale})`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container.current);
    for (const box of container.current.querySelectorAll('.gv-trip-route-name')) observer.observe(box);
    document.fonts?.ready.then(() => { if (!disposed) fit(); });
    return () => { disposed = true; observer.disconnect(); };
  }, [route]);
  return <dd ref={container} className="gv-trip-route-stacked" title={route}>
    <div className="gv-trip-route-line"><span className="gv-trip-route-caption">Origen</span><span className="gv-trip-route-name"><span>{origin}</span></span></div>
    <div className="gv-trip-route-line"><span className="gv-trip-route-caption">Destino</span><span className="gv-trip-route-name"><span>{destination}</span></span></div>
  </dd>;
}
