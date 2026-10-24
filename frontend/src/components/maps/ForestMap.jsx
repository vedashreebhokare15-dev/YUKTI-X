import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Popup, ScaleControl, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { classificationSlug, formatArea, formatConfidence, formatDate } from '../../utils/formatters';
import MapControls from './MapControls';
import MapLegend from './MapLegend';

const BASEMAPS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
  },
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
};

const CLASSIFICATION_COLORS = {
  'Likely Forest Loss': '#EF4444',
  'Possible Forest Loss': '#F59E0B',
  'No Detected Loss': '#269B5B',
  'Insufficient Evidence': '#8A94A6',
};

function makePatchCoordinates([lat, lng], index) {
  const size = 0.0075 + (index % 3) * 0.0018;
  const centerLat = lat - 0.004;
  const centerLng = lng + 0.003;
  return [
    [
      [centerLng - size, centerLat + size],
      [centerLng + size, centerLat + size],
      [centerLng + size, centerLat - size],
      [centerLng - size, centerLat - size],
      [centerLng - size, centerLat + size],
    ],
  ];
}

function buildLegendItems({ showLoss, showForestCover, showBoundary }) {
  const items = [];
  if (showLoss) {
    items.push(
      { label: 'Likely loss', color: '#EF4444' },
      { label: 'Possible loss', color: '#F59E0B' },
      { label: 'No detected loss', color: '#269B5B' },
      { label: 'Insufficient evidence', color: '#8A94A6' },
    );
  }
  if (showForestCover) items.push({ label: 'Forest cover', color: 'rgba(38,155,91,0.55)' });
  if (showBoundary) items.push({ label: 'Study-area boundary', type: 'outline' });
  return items;
}

const MEASURED_CLASS_ITEMS = [
  { label: 'No candidate loss', color: '#2f9e6b' },
  { label: 'Possible vegetation decline', color: '#e8912a' },
  { label: 'Candidate loss signal', color: '#d7263d' },
  { label: 'Insufficient evidence', color: '#6b6f76' },
];

// The colour stretches are fixed by the backend request, so the legend repeats them
// in words instead of implying a scale the tile cannot carry.
const MEASURED_LAYER_ITEMS = {
  deviation: { label: 'NDVI seasonal deviation: decline red, gain green', color: '#d7263d' },
  evidence: { label: 'Valid observations per 20 m cell: dark means none', color: '#1f77b4' },
  ndvi: { label: 'After-season NDVI (-0.2 to 0.8)', color: '#4e8f43' },
  ndmi: { label: 'After-season NDMI (-0.6 to 0.6)', color: '#17618c' },
  nbr: { label: 'After-season NBR (-0.6 to 0.8)', color: '#0d4d2a' },
};

function buildMeasuredLegend(tileLayers, visibleTiles) {
  const shown = tileLayers.filter((layer) => visibleTiles.includes(layer.name));
  const items = [];
  if (shown.some((layer) => layer.name === 'class')) items.push(...MEASURED_CLASS_ITEMS);
  shown.forEach((layer) => {
    if (MEASURED_LAYER_ITEMS[layer.name]) items.push(MEASURED_LAYER_ITEMS[layer.name]);
  });
  return items;
}

function MapReady({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
    return () => onReady(null);
  }, [map, onReady]);
  return null;
}

// Clicking the map is how a single 20 m cell is read back: the backend answers with
// the measured index values and the rule that produced the state.
function ClickHandler({ onClick }) {
  const map = useMap();
  useEffect(() => {
    if (!onClick) return undefined;
    const handler = (event) => onClick(event.latlng.lat, event.latlng.lng);
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map, onClick]);
  return null;
}

function MapSync({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: false });
  }, [map, center[0], center[1], zoom]);
  return null;
}

function MarkerIcon({ classification, selected }) {
  const slug = classificationSlug(classification);
  return L.divIcon({
    className: 'map-pin-wrap',
    html: `<span class="map-pin pin-${slug} ${selected ? 'pin-selected' : ''}"></span>`,
    iconSize: selected ? [19, 19] : [15, 15],
    iconAnchor: selected ? [9.5, 9.5] : [7.5, 7.5],
    popupAnchor: [0, -10],
  });
}

export default function ForestMap({
  center,
  zoom = 10,
  boundary,
  forestPatches,
  markers = [],
  showBoundary = true,
  showForestCover = false,
  showLoss = true,
  defaultBasemap = 'satellite',
  showControls = true,
  showLegend = true,
  showSampleLabel = true,
  selectedId = null,
  onMarkerClick,
  tileLayers = [],
  visibleTiles = [],
  onTileToggle,
  onMapClick,
  dataMode = 'demo',
  className = '',
  height,
}) {
  const [basemap, setBasemap] = useState(BASEMAPS[defaultBasemap] ? defaultBasemap : 'satellite');
  const [map, setMap] = useState(null);

  const lossFeatures = useMemo(() => {
    const risky = markers.filter(
      (marker) =>
        marker.classification === 'Likely Forest Loss' ||
        marker.classification === 'Possible Forest Loss',
    );
    return {
      type: 'FeatureCollection',
      features: risky.map((marker, index) => ({
        type: 'Feature',
        properties: {
          id: marker.id,
          classification: marker.classification,
          illustrative: true,
        },
        geometry: {
          type: 'Polygon',
          coordinates: makePatchCoordinates(marker.coordinates, index),
        },
      })),
    };
  }, [markers]);

  const legendItems = useMemo(
    () => (dataMode === 'real'
      ? buildMeasuredLegend(tileLayers, visibleTiles)
      : buildLegendItems({ showLoss, showForestCover, showBoundary })),
    [dataMode, showLoss, showForestCover, showBoundary, tileLayers, visibleTiles],
  );

  const realOverlays = useMemo(
    () => tileLayers.filter((layer) => visibleTiles.includes(layer.name) && layer.tile_url),
    [tileLayers, visibleTiles],
  );

  const base = BASEMAPS[basemap];

  return (
    <div
      className={`map-shell ${className}`.trim()}
      style={height ? { height } : undefined}
      role="region"
      aria-label="Interactive forest study-area map"
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <MapReady onReady={setMap} />
        <ClickHandler onClick={onMapClick} />
        <MapSync center={center} zoom={zoom} />
        <TileLayer key={basemap} url={base.url} attribution={base.attribution} maxZoom={base.maxZoom} />

        {realOverlays.map((layer) => (
          <TileLayer
            key={`measured-${layer.name}`}
            url={layer.tile_url}
            attribution="Sentinel-2 through Google Earth Engine"
            opacity={0.85}
            maxZoom={14}
          />
        ))}

        {showForestCover && forestPatches && (
          <GeoJSON
            key={`forest-${forestPatches.features?.[0]?.properties?.name || 'none'}`}
            data={forestPatches}
            style={{
              color: '#2E9B62',
              weight: 1,
              opacity: 0.55,
              fillColor: '#269B5B',
              fillOpacity: 0.18,
              dashArray: '3 4',
            }}
          />
        )}

        {showLoss && lossFeatures.features.length > 0 && (
          <GeoJSON
            key={`loss-${lossFeatures.features.map((feature) => feature.properties.id).join('-')}`}
            data={lossFeatures}
            style={(feature) => {
              const color = CLASSIFICATION_COLORS[feature.properties.classification] || '#8A94A6';
              return {
                color,
                weight: 1,
                opacity: 0.7,
                fillColor: color,
                fillOpacity: 0.28,
              };
            }}
          />
        )}

        {showBoundary && boundary && (
          <>
            <GeoJSON
              key={`boundary-shadow-${boundary.properties?.name}`}
              data={boundary}
              style={{ color: '#04281D', weight: 6, opacity: 0.3, fill: false }}
            />
            <GeoJSON
              key={`boundary-${boundary.properties?.name}`}
              data={boundary}
              style={{
                color: '#FFFFFF',
                weight: 2.2,
                opacity: 0.95,
                fillColor: '#FFFFFF',
                fillOpacity: 0.025,
                dashArray: '7 5',
              }}
            />
          </>
        )}

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.coordinates}
            icon={MarkerIcon({
              classification: marker.classification,
              selected: selectedId === marker.id,
            })}
            eventHandlers={{
              click: () => onMarkerClick?.(marker),
            }}
          >
            <Popup>
              <div className="map-popup">
                <div className="map-popup-head">
                  <div className="map-popup-title">{marker.location}</div>
                  <div className="map-popup-sub">
                    {marker.district}, {marker.state}
                  </div>
                </div>
                <div className="map-popup-body">
                  <span className={`badge badge-${classificationSlug(marker.classification)}`}>
                    <span className="dot" aria-hidden="true" />
                    {marker.classification}
                  </span>
                  <div className="map-popup-meta" style={{ marginTop: 9 }}>
                    <div>
                      Area
                      <strong>{formatArea(marker.areaKm2)}</strong>
                    </div>
                    <div>
                      Confidence
                      <strong>{formatConfidence(marker.confidence)}</strong>
                    </div>
                    <div>
                      Observed
                      <strong>{formatDate(marker.observationDate)}</strong>
                    </div>
                    <div>
                      Status
                      <strong>{marker.status}</strong>
                    </div>
                  </div>
                </div>
                <div className="map-popup-foot">Illustrative demo detection — not verified satellite data.</div>
              </div>
            </Popup>
          </Marker>
        ))}

        <ScaleControl position="bottomleft" imperial={false} metric />
      </MapContainer>

      {showControls && (
        <MapControls
          map={map}
          basemap={basemap}
          onBasemapChange={setBasemap}
          onReset={() => {
            setBasemap(defaultBasemap);
            map?.setView(center, zoom, { animate: true });
          }}
        />
      )}
      {showLegend && legendItems.length > 0 && <MapLegend items={legendItems} />}
      {dataMode === 'real'
        ? visibleTiles.length > 0 && (
            <div className="map-sample-label map-sample-label-measured">
              Measured Sentinel-2 layers from Google Earth Engine
            </div>
          )
        : showSampleLabel && <div className="map-sample-label">Illustrative demo layers</div>}
    </div>
  );
}
