/**
 * Utility to compress an image file in the browser to a target max KB size (default 77 KB)
 * @param {File} file File object captured from input or camera
 * @param {number} maxKb Target maximum file size in KB
 * @returns {Promise<{ base64: string, sizeKb: number, name: string, isPdf: boolean }>}
 */
export async function compressImageToMaxKb(file, maxKb = 77) {
  if (!file) {
    throw new Error("No se proporcionó ningún archivo.");
  }

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result;
        const base64Len = base64.length - (base64.indexOf(",") + 1);
        const sizeInBytes = Math.ceil((base64Len * 3) / 4);
        resolve({
          base64,
          sizeKb: Math.round(sizeInBytes / 1024),
          name: file.name,
          isPdf: true
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const maxSizeBytes = maxKb * 1024;
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Limitar dimensiones máximas iniciales a 1280px para acelerar compresión
        const MAX_INITIAL_DIM = 1280;
        if (width > MAX_INITIAL_DIM || height > MAX_INITIAL_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_INITIAL_DIM) / width);
            width = MAX_INITIAL_DIM;
          } else {
            width = Math.round((width * MAX_INITIAL_DIM) / height);
            height = MAX_INITIAL_DIM;
          }
        }

        const canvas = document.createElement("canvas");
        let currentWidth = width;
        let currentHeight = height;

        function renderAndCompress(w, h, targetBytes) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          let lowQuality = 0.05;
          let highQuality = 0.90;
          let bestDataUrl = canvas.toDataURL("image/jpeg", lowQuality);
          let bestSize = calculateBase64Bytes(bestDataUrl);

          // Búsqueda binaria de calidad JPEG (8 iteraciones)
          for (let i = 0; i < 8; i++) {
            const midQuality = (lowQuality + highQuality) / 2;
            const dataUrl = canvas.toDataURL("image/jpeg", midQuality);
            const bytes = calculateBase64Bytes(dataUrl);

            if (bytes <= targetBytes) {
              bestDataUrl = dataUrl;
              bestSize = bytes;
              lowQuality = midQuality; // probar mayor calidad
            } else {
              highQuality = midQuality; // reducir calidad
            }
          }

          return { dataUrl: bestDataUrl, bytes: bestSize };
        }

        function calculateBase64Bytes(dataUrl) {
          const base64Len = dataUrl.length - (dataUrl.indexOf(",") + 1);
          return Math.ceil((base64Len * 3) / 4);
        }

        let result = renderAndCompress(currentWidth, currentHeight, maxSizeBytes);

        // Si aún con baja calidad sobrepasa targetBytes, reducir dimensiones escalarmente
        let scaleStep = 0.85;
        let attempts = 0;
        while (result.bytes > maxSizeBytes && attempts < 5 && currentWidth > 300) {
          currentWidth = Math.round(currentWidth * scaleStep);
          currentHeight = Math.round(currentHeight * scaleStep);
          result = renderAndCompress(currentWidth, currentHeight, maxSizeBytes);
          attempts++;
        }

        resolve({
          base64: result.dataUrl,
          sizeKb: Math.round(result.bytes / 1024),
          name: file.name,
          isPdf: false
        });
      };

      img.onerror = (err) => reject(new Error("No se pudo cargar la imagen para compresión: " + err.message));
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
