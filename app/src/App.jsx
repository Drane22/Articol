import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { searchAlbums, getAlbumDetails } from './services/api';
import AlbumDetails from './components/AlbumDetails';
import logo from './assets/logo.png';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function App() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 400);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAlbumDetails, setSelectedAlbumDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (debouncedQuery) {
      setIsSearching(true);
      searchAlbums(debouncedQuery).then(data => {
        setResults(data);
        setIsSearching(false);
        setIsDropdownOpen(true);
      });
    } else {
      setResults([]);
      setIsDropdownOpen(false);
    }
  }, [debouncedQuery]);

  const handleSelectAlbum = async (album) => {
    setIsDropdownOpen(false);
    setIsLoadingDetails(true);
    const details = await getAlbumDetails(album.id);
    if (details) {
      setSelectedAlbumDetails(details);
    }
    setIsLoadingDetails(false);
  };

  const handleBack = () => {
    setSelectedAlbumDetails(null);
  };

  return (
    <>
      <header className="top-bar">
        <div className="top-bar-logo">
          <img src={logo} alt="Articol Logo" className="logo-img" />
          <span>Articol</span>
        </div>
        
        <div className="search-container">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} color="var(--color-obsidian)" style={{ position: 'absolute', left: 0 }} />
            <input
              type="text"
              placeholder="Search artists, albums..."
              className="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (results.length > 0) setIsDropdownOpen(true); }}
              style={{ paddingLeft: '28px' }}
            />
          </div>

          {isDropdownOpen && results.length > 0 && (
            <div className="search-dropdown">
              {results.slice(0, 6).map(album => (
                <div
                  key={album.id}
                  className="search-dropdown-item"
                  onClick={() => handleSelectAlbum(album)}
                >
                  <img src={album.artworkUrlSmall} alt="" className="dropdown-art" />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 'var(--text-body-sm)' }}>{album.title}</span>
                    <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-felt-gray)' }}>{album.artist}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="top-bar-menu" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>
          <span>EN / VN / 中文</span>
        </div>
      </header>

      {selectedAlbumDetails ? (
        <AlbumDetails
          albumDetails={selectedAlbumDetails}
          onBack={handleBack}
          onSelectAlbum={handleSelectAlbum}
        />
      ) : (
        <main className="container" style={{ paddingTop: '150px' }}>
          {isLoadingDetails ? (
            <div style={{ textAlign: 'center', marginTop: 'var(--spacing-64)' }}>
              <p style={{ fontSize: 'var(--text-heading-sm)', fontFamily: 'var(--font-raleway)', fontWeight: 300 }}>Loading...</p>
            </div>
          ) : (
            <>
              {results.length > 0 && !isDropdownOpen ? (
                <>
                  <h1 className="section-heading" style={{ fontSize: 'var(--text-heading)', fontFamily: 'var(--font-raleway)' }}>Search Results</h1>
                  <div className="album-grid">
                    {results.map(album => (
                      <article key={album.id} className="album-card" onClick={() => handleSelectAlbum(album)}>
                        <div className="album-art-wrapper">
                          <img src={album.artworkUrlSmall} alt={album.title} loading="lazy" />
                        </div>
                        <h3 className="album-card-title">{album.title}</h3>
                        <p className="album-card-artist">{album.artist}</p>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', marginTop: '10vh' }}>
                  <h1 style={{ fontSize: 'var(--text-display)', fontWeight: 400, letterSpacing: '-0.02em', marginLeft: '-0.05em' }}>Articol</h1>
                  <p style={{ fontSize: 'var(--text-subheading)', fontWeight: 300, color: 'var(--color-felt-gray)' }}>
                    Search for an album to experience liquid light.
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      )}
    </>
  );
}
