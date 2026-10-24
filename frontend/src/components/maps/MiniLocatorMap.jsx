import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';

export default function MiniLocatorMap({ center, label }) {
  return (
    <div className="locator-card">
      <MapContainer
        center={[22.6, 79.4]}
        zoom={4}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
        touchZoom={false}
        style={{ height: 148, width: '100%' }}
        aria-label={`Illustrative locator map for ${label}`}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <CircleMarker
          center={center}
          radius={8}
          pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: '#08764F', fillOpacity: 1 }}
        />
        <CircleMarker
          center={center}
          radius={14}
          pathOptions={{ color: '#08764F', weight: 1, opacity: 0.7, fillColor: '#16845C', fillOpacity: 0.18 }}
        />
      </MapContainer>
      <span className="locator-label">Illustrative locator</span>
    </div>
  );
}
