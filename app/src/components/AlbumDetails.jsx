import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getColorSync } from 'colorthief';
import { Play, Pause } from 'lucide-react';
import { getAlbumPool } from '../services/api';
import { findSimilarAlbums } from '../services/colorUtils';

export default function AlbumDetails({ albumDetails, onBack, onSelectAlbum }) {
  const { album, tracks } = albumDetails;
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const [similarAlbums, setSimilarAlbums] = useState([]);
  const [isFindingSimilar, setIsFindingSimilar] = useState(false);
  const audioRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [album.id]);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;
    const handleEnded = () => setPlayingTrackId(null);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Color extraction for SIMILARITY ENGINE ONLY.
  // The UI strictly adheres to the monochrome + iridescent hero spec.
  const handleImageLoad = useCallback(async () => {
    const img = imgRef.current;
    if (!img) return;

    let extractedRgb = null;

    try {
      const colorArray = getColorSync(img);
      if (colorArray) {
        extractedRgb = { r: colorArray[0], g: colorArray[1], b: colorArray[2] };
      }
    } catch (e) {
      console.warn('Color extraction failed:', e.message);
    }

    if (extractedRgb) {
      setIsFindingSimilar(true);
      try {
        const pool = await getAlbumPool();
        const similar = await findSimilarAlbums(extractedRgb, pool, album.id);
        setSimilarAlbums(similar);
      } catch (err) {
        console.error('Failed to find similar albums', err);
      }
      setIsFindingSimilar(false);
    }
  }, [album.id]);

  const togglePlay = useCallback((track) => {
    const audio = audioRef.current;
    if (!audio || !track.previewUrl) return;

    if (playingTrackId === track.id) {
      audio.pause();
      setPlayingTrackId(null);
    } else {
      audio.src = track.previewUrl;
      audio.play().catch(() => setPlayingTrackId(null));
      setPlayingTrackId(track.id);
    }
  }, [playingTrackId]);

  const formatTime = (seconds) => {
    if (!seconds) return '-:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="details-page">
      {/* Iridescent Hero Section */}
      <section className="details-hero">
        <div className="details-hero-inner">
          <div className="hero-info">
            <button onClick={onBack} className="btn-ghost-dark" style={{ alignSelf: 'flex-start', marginBottom: 'var(--spacing-40)' }}>
              BACK TO SEARCH
            </button>
            <h1 className="hero-title">{album.title}</h1>
            <p className="hero-artist">{album.artist}</p>
            <div style={{ display: 'flex', gap: '14px', marginTop: '14px', fontSize: '12px', opacity: 0.8, letterSpacing: '0.05em' }}>
              <span>{album.year}</span>
              {album.genre && <span>·</span>}
              {album.genre && <span>{album.genre.toUpperCase()}</span>}
              <span>·</span>
              <span>{album.trackCount} TRACKS</span>
            </div>
          </div>
          <div>
            <img
              ref={imgRef}
              src={album.artworkUrl}
              alt={`${album.title} by ${album.artist}`}
              className="hero-art"
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
            />
          </div>
        </div>
      </section>

      {/* Tracklist Section */}
      <section className="tracklist-section">
        <h2 className="section-heading">Tracklist</h2>
        <div className="tracklist-container">
          {tracks.map((track) => (
            <div key={track.id} className="track-row">
              <span className="track-num">{String(track.num).padStart(2, '0')}</span>
              <button
                className="play-btn"
                onClick={() => togglePlay(track)}
                disabled={!track.previewUrl}
              >
                {playingTrackId === track.id ? <Pause size={12} strokeWidth={2} /> : <Play size={12} strokeWidth={2} style={{ marginLeft: 2 }} />}
              </button>
              <span className="track-name">{track.name}</span>
              <span className="track-duration">{formatTime(track.durationSec)}</span>
            </div>
          ))}
        </div>
      </section>
      
      {/* Visually Similar Albums Section */}
      <section className="similar-section">
        <h2 className="section-heading">Visually Similar Albums</h2>
        
        {isFindingSimilar ? (
          <div className="album-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="album-card skeleton">
                <div className="album-art-wrapper skeleton" />
                <div className="skeleton-text" style={{ width: '80%', marginBottom: 8 }} />
                <div className="skeleton-text" style={{ width: '60%' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="album-grid">
            {similarAlbums.map((related) => (
              <article
                key={related.id}
                className="album-card"
                onClick={() => onSelectAlbum(related)}
              >
                <div className="album-art-wrapper">
                  <img
                    src={related.artworkUrlSmall || related.artworkUrl}
                    alt={`${related.title} by ${related.artist}`}
                    loading="lazy"
                  />
                </div>
                <h3 className="album-card-title">{related.title}</h3>
                <p className="album-card-artist">{related.artist}</p>
              </article>
            ))}
            {similarAlbums.length === 0 && !isFindingSimilar && (
              <p style={{ color: 'var(--color-felt-gray)', fontStyle: 'italic', fontSize: 'var(--text-body-sm)' }}>
                No visually similar albums found in the pool.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
