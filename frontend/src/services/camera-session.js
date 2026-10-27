export function cameraErrorMessage(error) {
  if (["NotAllowedError", "SecurityError"].includes(error?.name)) return "Permite el acceso a la cámara en los ajustes de la aplicación o del navegador y vuelve a intentarlo.";
  if (["NotFoundError", "DevicesNotFoundError"].includes(error?.name)) return "No se encontró una cámara disponible en este dispositivo.";
  if (["NotReadableError", "TrackStartError"].includes(error?.name)) return "La cámara está ocupada. Cierra otras aplicaciones que la estén usando y vuelve a intentarlo.";
  return error?.message === "CAMERA_UNSUPPORTED" ? "La cámara necesita una conexión HTTPS y un navegador compatible." : "No se pudo iniciar la cámara. Revisa sus permisos y vuelve a intentarlo.";
}

export function createCameraSession(mediaDevices) {
  let disposed = false;
  let stream;
  return {
    async start(facingMode = "environment") {
      if (!mediaDevices?.getUserMedia) throw new Error("CAMERA_UNSUPPORTED");
      const acquired = await mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } }, audio: false });
      if (disposed) { acquired.getTracks().forEach(track => track.stop()); return null; }
      stream = acquired;
      return stream;
    },
    stop() {
      disposed = true;
      stream?.getTracks().forEach(track => track.stop());
      stream = null;
    }
  };
}
