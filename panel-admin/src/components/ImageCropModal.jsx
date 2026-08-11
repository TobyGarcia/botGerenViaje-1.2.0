import { useEffect, useRef, useState } from "react";

export default function ImageCropModal({ source, onCancel, onConfirm }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const image = new Image();
    image.onload = () => { imageRef.current = image; draw(); };
    image.src = source;
  }, [source]);

  function draw() {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const context = canvas.getContext("2d");
    const size = canvas.width;
    context.clearRect(0, 0, size, size);
    context.fillStyle = "#e8f1f5";
    context.fillRect(0, 0, size, size);
    const scale = Math.max(size / image.width, size / image.height) * zoom;
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  }
  useEffect(draw, [zoom]);

  return <div className="modal-overlay" role="presentation">
    <section className="modal-card crop-modal" role="dialog" aria-modal="true" aria-labelledby="crop-title">
      <div className="form-panel-header"><div><h2 id="crop-title">Ajustar foto de perfil</h2><p>Usa el control para encuadrar tu imagen en formato cuadrado.</p></div><button className="close-button" onClick={onCancel} aria-label="Cerrar">×</button></div>
      <canvas ref={canvasRef} width="420" height="420" className="crop-canvas" />
      <label className="crop-zoom">Zoom<input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button><button type="button" className="primary-button" onClick={()=>onConfirm(canvasRef.current.toDataURL("image/jpeg", .88))}>Usar esta foto</button></div>
    </section>
  </div>;
}
