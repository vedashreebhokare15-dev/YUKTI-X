import { Map, Minus, Plus, RotateCcw, Satellite } from 'lucide-react';

export default function MapControls({ map, basemap, onBasemapChange, onReset }) {
  return (
    <div className="map-controls map-overlay">
      <div className="map-basemap-toggle" role="group" aria-label="Base map style">
        <button
          type="button"
          className={`map-basemap-btn ${basemap === 'streets' ? 'active' : ''}`}
          onClick={() => onBasemapChange('streets')}
          aria-pressed={basemap === 'streets'}
        >
          <Map size={12} aria-hidden="true" />
          Map
        </button>
        <button
          type="button"
          className={`map-basemap-btn ${basemap === 'satellite' ? 'active' : ''}`}
          onClick={() => onBasemapChange('satellite')}
          aria-pressed={basemap === 'satellite'}
        >
          <Satellite size={12} aria-hidden="true" />
          Satellite
        </button>
      </div>

      <div className="map-zoom-group">
        <button
          type="button"
          className="map-zoom-btn"
          onClick={() => map?.zoomIn()}
          aria-label="Zoom in"
          disabled={!map}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          className="map-zoom-btn"
          onClick={() => map?.zoomOut()}
          aria-label="Zoom out"
          disabled={!map}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          className="map-zoom-btn"
          onClick={onReset}
          aria-label="Reset map view"
          disabled={!map}
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
}
