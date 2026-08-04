export function AlbumGridSkeleton() { return <div className="album-grid">{Array.from({ length: 10 }, (_, index) => <div className="album-card" key={index}><div className="cover skeleton" /><i className="skeleton-line" /><i className="skeleton-line short" /></div>)}</div>; }

export default function AlbumGrid({ albums, onSelect, label = 'Search results', note }) {
  if (!albums?.length) return null;
  return <section className="album-section"><div className="section-heading"><div><p className="eyebrow">{label}</p>{note && <p className="section-note">{note}</p>}</div><span>{albums.length} covers</span></div><div className="album-grid">{albums.map((album) => <button className="album-card" key={album.id} onClick={() => onSelect(album)}><img className="cover" src={album.artworkUrlSmall || album.artworkUrl} alt={`${album.title} by ${album.artist}`} loading="lazy" /><strong>{album.title}</strong><small>{album.artist}{album.year && ` · ${album.year}`}</small></button>)}</div></section>;
}
