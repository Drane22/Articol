import { getColorSync } from 'colorthief';

/**
 * Calculate the Euclidean distance between two RGB colors.
 */
const colorDistance = (rgb1, rgb2) => {
  return Math.sqrt(
    Math.pow(rgb2.r - rgb1.r, 2) +
    Math.pow(rgb2.g - rgb1.g, 2) +
    Math.pow(rgb2.b - rgb1.b, 2)
  );
};

/**
 * Extracts the dominant color from an image URL.
 * Uses a small canvas to load the image if colorthief fails or for rapid processing.
 */
export const getDominantColor = async (imgUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgUrl;

    img.onload = () => {
      try {
        const colorArray = getColorSync(img);
        if (colorArray) {
          resolve({ r: colorArray[0], g: colorArray[1], b: colorArray[2] });
          return;
        }
      } catch (e) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 1, 1);
          const data = ctx.getImageData(0, 0, 1, 1).data;
          resolve({ r: data[0], g: data[1], b: data[2] });
        } catch (fallbackError) {
          reject(fallbackError);
        }
      }
    };

    img.onerror = reject;
  });
};

/**
 * Find the most visually similar albums in the pool compared to a target color.
 */
export const findSimilarAlbums = async (targetColorRgb, albumPool, currentAlbumId) => {
  if (!targetColorRgb || !albumPool || albumPool.length === 0) return [];
  
  const candidates = albumPool.filter(a => a.id !== currentAlbumId);
  const chunkSize = 10;
  const processedAlbums = [];

  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize);
    
    const promises = chunk.map(async (album) => {
      try {
        // Use the micro thumbnail for faster processing
        const color = await getDominantColor(album.artworkUrlMicro);
        const distance = colorDistance(targetColorRgb, color);
        return { album, distance };
      } catch (e) {
        return { album, distance: 9999 };
      }
    });

    const results = await Promise.all(promises);
    processedAlbums.push(...results);
  }

  // Sort by lowest distance (most similar)
  processedAlbums.sort((a, b) => a.distance - b.distance);
  
  // Return top 8 most similar albums
  return processedAlbums.slice(0, 8).map(item => item.album);
};
