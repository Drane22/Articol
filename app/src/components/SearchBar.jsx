import { Search } from 'lucide-react';

export default function SearchBar({ value, onChange, searchResults, isSearching, onSelectResult }) {
  const showDropdown = value.trim() && (isSearching || searchResults.length > 0);
  return <header className="site-header"><div className="container nav-bar">
    <button className="brand" onClick={() => onChange('')} aria-label="Articol home"><img src="/articol-mark.svg" alt="Articol" /></button>
    <div className="search-wrapper"><Search size={19} /><input id="album-search-input" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search an album or artist" autoComplete="off" spellCheck="false" />
      {showDropdown && <div className="search-dropdown">{isSearching ? <p>Finding records...</p> : searchResults.slice(0, 6).map((album) => <button key={album.id} onClick={() => onSelectResult(album)}><img src={album.artworkUrlSmall} alt="" /><span><strong>{album.title}</strong><small>{album.artist} {album.year && `· ${album.year}`}</small></span></button>)}</div>}
    </div>
  </div></header>;
}
