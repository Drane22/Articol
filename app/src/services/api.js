/**
 * iTunes API service using JSONP to bypass CORS.
 */

let jsonpCounter = 0;

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `__itunesCb_${jsonpCounter++}_${Date.now()}`;
    const script = document.createElement('script');

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Request timed out'));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Network request failed'));
    };

    const separator = url.includes('?') ? '&' : '?';
    script.src = `${url}${separator}callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

/**
 * Search for albums on iTunes.
 */
export const searchAlbums = async (query) => {
  if (!query || !query.trim()) return [];

  try {
    const data = await jsonp(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query.trim())}&entity=album&limit=24`
    );

    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map(album => ({
      id: album.collectionId,
      title: album.collectionName || 'Unknown Album',
      artist: album.artistName || 'Unknown Artist',
      artworkUrl: album.artworkUrl100 ? album.artworkUrl100.replace('100x100bb', '600x600bb') : '',
      artworkUrlSmall: album.artworkUrl100 ? album.artworkUrl100.replace('100x100bb', '250x250bb') : '',
      trackCount: album.trackCount || 0,
      genre: album.primaryGenreName || '',
      year: album.releaseDate ? album.releaseDate.substring(0, 4) : '',
    }));
  } catch (error) {
    console.error('Error searching albums:', error);
    return [];
  }
};

/**
 * Get full album details + tracklist from iTunes.
 */
export const getAlbumDetails = async (albumId) => {
  if (!albumId) return null;

  try {
    const data = await jsonp(`https://itunes.apple.com/lookup?id=${albumId}&entity=song`);
    
    if (!data.results || data.results.length === 0) return null;

    // First result is the album, subsequent are tracks
    const albumData = data.results.find(r => r.wrapperType === 'collection');
    const tracksRaw = data.results.filter(r => r.wrapperType === 'track');

    if (!albumData) return null;

    const album = {
      id: albumData.collectionId,
      title: albumData.collectionName || 'Unknown Album',
      artist: albumData.artistName || 'Unknown Artist',
      artworkUrl: albumData.artworkUrl100 ? albumData.artworkUrl100.replace('100x100bb', '600x600bb') : '',
      year: albumData.releaseDate ? albumData.releaseDate.substring(0, 4) : '',
      genre: albumData.primaryGenreName || '',
      trackCount: albumData.trackCount || 0,
    };

    const tracks = tracksRaw
      .sort((a, b) =>
        (a.discNumber - b.discNumber) || (a.trackNumber - b.trackNumber)
      )
      .map(track => ({
        id: track.trackId,
        num: track.trackNumber,
        disc: track.discNumber,
        name: track.trackName || 'Untitled',
        durationSec: track.trackTimeMillis ? Math.floor(track.trackTimeMillis / 1000) : 0,
        previewUrl: track.previewUrl || null,
      }));

    return { album, tracks };
  } catch (error) {
    console.error('Error fetching album details:', error);
    return null;
  }
};

let cachedAlbumPool = null;

/**
 * Get a large pool of popular albums from iTunes for visual similarity searches.
 */
export const getAlbumPool = async () => {
  if (cachedAlbumPool) return cachedAlbumPool;

  try {
    // Search a generic term to get a large list of diverse albums
    const data = await jsonp(`https://itunes.apple.com/search?term=music&entity=album&limit=150`);
    if (!data.results || !Array.isArray(data.results)) return [];

    cachedAlbumPool = data.results
      .filter(album => album.collectionId && album.artworkUrl100)
      .map(album => ({
        id: album.collectionId,
        title: album.collectionName || 'Unknown',
        artist: album.artistName || 'Unknown',
        artworkUrl: album.artworkUrl100.replace('100x100bb', '600x600bb'),
        artworkUrlSmall: album.artworkUrl100.replace('100x100bb', '250x250bb'),
        artworkUrlMicro: album.artworkUrl100.replace('100x100bb', '56x56bb'), // Fast for color processing
      }));

    return cachedAlbumPool;
  } catch (error) {
    console.error('Error fetching album pool:', error);
    return [];
  }
};
