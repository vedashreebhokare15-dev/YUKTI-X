import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Download,
  Eye,
  FolderOpen,
  Layers,
  MapPin,
  Mountain,
  Save,
  Trash2,
  Trees,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import FormField from '../components/common/FormField';
import RegionSelector from '../components/forms/RegionSelector';
import DateRangeFilter from '../components/forms/DateRangeFilter';
import DemoNotice from '../components/common/DemoNotice';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import EmptyState from '../components/common/EmptyState';
import DataTable from '../components/common/DataTable';
import Pagination from '../components/common/Pagination';
import ToggleSwitch from '../components/common/ToggleSwitch';
import ForestMap from '../components/maps/ForestMap';
import MiniLocatorMap from '../components/maps/MiniLocatorMap';
import { useApp } from '../context/AppContext';
import { getDistricts, getRegionById, getRegionsForDistrict } from '../data/studyAreas';
import { formatArea, formatDate, formatPercent } from '../utils/formatters';
import { exportBoundaryGeoJSON } from '../utils/exportGeoJSON';

const PAGE_SIZE = 5;

export default function StudyArea() {
  const { preferences, savedAreas, saveStudyArea, deleteSavedArea, showToast } = useApp();
  const navigate = useNavigate();
  const initialRegion = getRegionById(preferences.defaultRegionId) || getRegionById('region-mulshi');

  const [stateValue, setStateValue] = useState(initialRegion.state);
  const [districtValue, setDistrictValue] = useState(initialRegion.district);
  const [regionId, setRegionId] = useState(initialRegion.id);
  const [startDate, setStartDate] = useState('2024-06-01');
  const [endDate, setEndDate] = useState('2024-11-30');
  const [errors, setErrors] = useState({});
  const [layers, setLayers] = useState({
    forestCover: true,
    boundary: true,
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [page, setPage] = useState(1);

  const selectedRegion = getRegionById(regionId);
  const pagedAreas = useMemo(
    () => savedAreas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [savedAreas, page],
  );

  const handleStateChange = (nextState) => {
    setStateValue(nextState);
    setErrors({});
    const nextDistrict = getDistricts(nextState)[0] || '';
    setDistrictValue(nextDistrict);
    const nextRegion = nextDistrict ? getRegionsForDistrict(nextState, nextDistrict)[0] : null;
    setRegionId(nextRegion?.id || '');
  };

  const handleDistrictChange = (nextDistrict) => {
    setDistrictValue(nextDistrict);
    setErrors({});
    const nextRegion = getRegionsForDistrict(stateValue, nextDistrict)[0];
    setRegionId(nextRegion?.id || '');
  };

  const validate = () => {
    const next = {};
    if (!stateValue) next.state = 'Select a state.';
    if (!districtValue) next.district = 'Select a district.';
    if (!regionId) next.region = 'Select a forest area.';
    if (!startDate) next.start = 'Select a start date.';
    if (!endDate) next.end = 'Select an end date.';
    if (startDate && endDate && startDate > endDate) {
      next.end = 'End date cannot be before the start date.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate() || !selectedRegion) {
      showToast({
        type: 'error',
        title: 'Cannot save this selection',
        message: 'Choose a complete, valid region and date range first.',
      });
      return;
    }
    saveStudyArea({
      regionId: selectedRegion.id,
      regionName: selectedRegion.name,
      state: selectedRegion.state,
      district: selectedRegion.district,
      startDate,
      endDate,
      areaKm2: selectedRegion.areaKm2,
      savedAt: new Date().toISOString(),
      isDemo: true,
    });
    setPage(1);
    showToast({
      type: 'success',
      title: 'Study area saved',
      message: `${selectedRegion.name} · ${formatDate(startDate)} – ${formatDate(endDate)}. Stored locally in this browser.`,
    });
  };

  const reopenSelection = (area) => {
    const region = getRegionById(area.regionId);
    if (!region) {
      showToast({
        type: 'error',
        title: 'Region unavailable',
        message: 'This saved demo selection refers to a region that is no longer available.',
      });
      return;
    }
    setStateValue(region.state);
    setDistrictValue(region.district);
    setRegionId(region.id);
    setStartDate(area.startDate);
    setEndDate(area.endDate);
    setErrors({});
    showToast({
      type: 'info',
      title: 'Saved selection reopened',
      message: `${area.regionName} is loaded in the study-area workspace.`,
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteSavedArea(deleteTarget.id);
    showToast({
      type: 'success',
      title: 'Saved selection removed',
      message: `${deleteTarget.regionName} was removed from this browser's demo workspace.`,
    });
    setDeleteTarget(null);
  };

  const startAnalysis = () => {
    if (!selectedRegion) return;
    const params = new URLSearchParams({
      state: selectedRegion.state,
      regionId: selectedRegion.id,
      start: startDate,
      end: endDate,
    });
    navigate(`/analysis?${params.toString()}`);
  };

  const downloadBoundary = () => {
    if (!selectedRegion) return;
    exportBoundaryGeoJSON(
      selectedRegion.boundary,
      `vanadrishti-${selectedRegion.name}-illustrative-boundary`,
    );
    showToast({
      type: 'success',
      title: 'Boundary GeoJSON downloaded',
      message: 'This file contains an illustrative polygon — it is not an official forest boundary.',
    });
  };

  const columns = [
    {
      key: 'regionName',
      label: 'Region',
      render: (area) => (
        <div className="table-location">
          <span className="table-location-dot" style={{ background: '#16845C' }} aria-hidden="true" />
          <div className="table-location-copy">
            <div className="cell-strong">{area.regionName}</div>
            <div className="cell-muted">
              {area.district}, {area.state}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'startDate', label: 'Start Date', render: (area) => formatDate(area.startDate) },
    { key: 'endDate', label: 'End Date', render: (area) => formatDate(area.endDate) },
    {
      key: 'areaKm2',
      label: 'Area',
      align: 'right',
      render: (area) => <span className="num">{formatArea(area.areaKm2)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (area) => (
        <div className="btn-group" style={{ justifyContent: 'flex-end', gap: 4 }}>
          <button
            type="button"
            className="icon-btn plain"
            onClick={(event) => {
              event.stopPropagation();
              reopenSelection(area);
            }}
            aria-label={`Reopen ${area.regionName} selection`}
            title="Reopen selection"
          >
            <FolderOpen size={14} />
          </button>
          <button
            type="button"
            className="icon-btn plain danger"
            onClick={(event) => {
              event.stopPropagation();
              setDeleteTarget(area);
            }}
            aria-label={`Remove ${area.regionName} selection`}
            title="Remove saved selection"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Study Area"
        subtitle="Select a region in India to define your study area and view its details."
        meta={
          <>
            <span className="badge badge-info">
              <span className="dot" aria-hidden="true" />
              Illustrative boundaries
            </span>
            <span className="chip neutral">Saved areas stored locally</span>
          </>
        }
      />

      <section className="card filter-bar" aria-label="Study area selection">
        <RegionSelector
          stateValue={stateValue}
          districtValue={districtValue}
          regionValue={regionId}
          onStateChange={handleStateChange}
          onDistrictChange={handleDistrictChange}
          onRegionChange={(value) => {
            setRegionId(value);
            setErrors({});
          }}
          stateError={errors.state}
          districtError={errors.district}
          regionError={errors.region}
        />
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          startError={errors.start}
          endError={errors.end}
          onStartChange={(value) => {
            setStartDate(value);
            setErrors((current) => ({ ...current, start: undefined, end: undefined }));
          }}
          onEndChange={(value) => {
            setEndDate(value);
            setErrors((current) => ({ ...current, end: undefined, start: undefined }));
          }}
        />
        <div className="filter-button">
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            <Save size={14} aria-hidden="true" />
            Save Area
          </button>
        </div>
      </section>

      {selectedRegion ? (
        <div className="study-layout">
          <section className="card map-card" aria-labelledby="study-map-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="study-map-title">
                  <MapPin size={16} aria-hidden="true" />
                  {selectedRegion.name}
                </h2>
                <p className="card-subtitle">
                  {selectedRegion.district}, {selectedRegion.state} ·{' '}
                  {formatArea(selectedRegion.areaKm2)} selected
                </p>
              </div>
              <span className="chip warning">Illustrative boundary</span>
            </div>
            <div className="map-card-body">
              <ForestMap
                center={selectedRegion.center}
                zoom={10}
                boundary={selectedRegion.boundary}
                forestPatches={selectedRegion.forestPatches}
                markers={[]}
                showBoundary={layers.boundary}
                showForestCover={layers.forestCover}
                showLoss={false}
                defaultBasemap={preferences.mapView}
                className="study"
              />
            </div>
          </section>

          <div className="study-side">
            <section className="card" aria-labelledby="map-information-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="map-information-title">
                    <Layers size={16} aria-hidden="true" />
                    Map Information
                  </h2>
                  <p className="card-subtitle">Layers and region metadata</p>
                </div>
              </div>
              <div className="card-body" style={{ paddingTop: 10 }}>
                <div className="sidebar-label" style={{ color: 'var(--muted-soft)', padding: 0 }}>
                  Map Layers
                </div>
                <div className="layer-list" style={{ marginBottom: 12 }}>
                  {[
                    { key: 'forestCover', label: 'Forest cover', icon: Trees },
                    { key: 'boundary', label: 'Study-area boundary', icon: MapPin },
                  ].map((layer) => {
                    const Icon = layer.icon;
                    return (
                      <div className="layer-toggle-row" key={layer.key}>
                        <span className="layer-toggle-label">
                          <Icon size={13} aria-hidden="true" />
                          {layer.label}
                        </span>
                        <ToggleSwitch
                          checked={layers[layer.key]}
                          onChange={(checked) => setLayers((current) => ({ ...current, [layer.key]: checked }))}
                          label={`Toggle ${layer.label} layer`}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="region-info-grid">
                  <div className="region-info-item">
                    <div className="k">State</div>
                    <div className="v">{selectedRegion.state}</div>
                  </div>
                  <div className="region-info-item">
                    <div className="k">District</div>
                    <div className="v">{selectedRegion.district}</div>
                  </div>
                  <div className="region-info-item">
                    <div className="k">Approximate area</div>
                    <div className="v">{formatArea(selectedRegion.areaKm2)}</div>
                  </div>
                  <div className="region-info-item">
                    <div className="k">Boundary</div>
                    <div className="v">Illustrative demo polygon</div>
                  </div>
                </div>

                <MiniLocatorMap center={selectedRegion.center} label={selectedRegion.name} />
              </div>
            </section>

            <section className="card" aria-labelledby="study-summary-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="study-summary-title">
                    <Mountain size={16} aria-hidden="true" />
                    Study Area Summary
                  </h2>
                  <p className="card-subtitle">Illustrative demonstration figures</p>
                </div>
                <span className="chip">Demo</span>
              </div>
              <div className="card-body">
                <div className="study-summary-lines">
                  <div className="study-summary-line">
                    <span>Region</span>
                    <strong>{selectedRegion.name}</strong>
                  </div>
                  <div className="study-summary-line">
                    <span>State</span>
                    <strong>{selectedRegion.state}</strong>
                  </div>
                  <div className="study-summary-line">
                    <span>Total area</span>
                    <strong>{formatArea(selectedRegion.areaKm2)}</strong>
                  </div>
                  <div className="study-summary-line">
                    <span>Elevation range</span>
                    <strong>{selectedRegion.elevation}</strong>
                  </div>
                </div>
                <div className="forest-cover-meter">
                  <div className="forest-cover-meter-head">
                    <span>Approximate forest cover</span>
                    <strong>{formatPercent(selectedRegion.forestCoverPercent)}</strong>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${selectedRegion.forestCoverPercent}%` }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <DemoNotice>
                    Area, forest-cover and elevation values are illustrative demo figures, not verified
                    measurements.
                  </DemoNotice>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <EmptyState
            icon={MapPin}
            title="Select a study area"
            message="Choose a state, district and forest area to display the map and region information."
          />
        </div>
      )}

      {selectedRegion && (
        <section className="card region-detail-card" aria-labelledby="region-details-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="region-details-title">
                <Trees size={16} aria-hidden="true" />
                Region Details
              </h2>
              <p className="card-subtitle">Context for the selected demonstration landscape</p>
            </div>
            <div className="card-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetailsOpen(true)}>
                <Eye size={13} aria-hidden="true" />
                View Region Details
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={downloadBoundary}>
                <Download size={13} aria-hidden="true" />
                Download Boundary
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={startAnalysis}>
                Start Analysis
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="region-detail-grid">
            <div className="region-detail-image">
              <img
                src={selectedRegion.image}
                alt={`Illustrative forest landscape representing ${selectedRegion.name}`}
                loading="lazy"
              />
              <span className="image-tag">Representative landscape</span>
            </div>
            <div className="region-detail-copy">
              <h3>{selectedRegion.name}</h3>
              <div className="region-detail-meta">
                <span className="badge badge-info">
                  <span className="dot" aria-hidden="true" />
                  {selectedRegion.state}
                </span>
                <span className="chip neutral">{selectedRegion.district}</span>
                <span className="chip neutral">{formatArea(selectedRegion.areaKm2)}</span>
              </div>
              <p className="region-description">{selectedRegion.description}</p>
              <p className="region-description">
                <strong style={{ color: 'var(--heading)' }}>Ecological importance: </strong>
                {selectedRegion.importance}
              </p>
              <div className="region-facts">
                <div className="region-fact">
                  <div className="k">
                    <MapPin size={11} aria-hidden="true" />
                    General location
                  </div>
                  <div className="v">{selectedRegion.location}</div>
                </div>
                <div className="region-fact">
                  <div className="k">
                    <Mountain size={11} aria-hidden="true" />
                    Elevation
                  </div>
                  <div className="v">{selectedRegion.elevation} (illustrative)</div>
                </div>
              </div>
            </div>
          </div>
          <div className="card-foot">
            <DemoNotice>
              Region text, forest-cover figures and the sample landscape photograph are demonstration
              content. The map boundary is illustrative and not an official administrative or forest
              boundary.
            </DemoNotice>
          </div>
        </section>
      )}

      <section className="card recent-card" aria-labelledby="recent-selections-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="recent-selections-title">
              Recent Selections
            </h2>
            <p className="card-subtitle">Saved study areas kept in this browser for the demo</p>
          </div>
          <span className="chip neutral">{savedAreas.length} saved</span>
        </div>
        <DataTable
          columns={columns}
          rows={pagedAreas}
          selectedKey={null}
          caption="Saved study area selections"
          emptyTitle="No saved selections"
          emptyMessage="Choose a region and date range, then use Save Area to keep a demo selection."
        />
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={savedAreas.length}
          onChange={setPage}
          itemLabel="saved areas"
        />
      </section>

      <ConfirmationModal
        open={Boolean(deleteTarget)}
        title="Remove saved selection?"
        message={
          deleteTarget
            ? `${deleteTarget.regionName} (${formatDate(deleteTarget.startDate)} – ${formatDate(
                deleteTarget.endDate,
              )}) will be removed from this browser's demo workspace. This cannot be undone.`
            : ''
        }
        confirmLabel="Remove selection"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      <Modal
        open={detailsOpen && Boolean(selectedRegion)}
        onClose={() => setDetailsOpen(false)}
        title={selectedRegion?.name || 'Region details'}
        subtitle={
          selectedRegion
            ? `${selectedRegion.district}, ${selectedRegion.state} · demonstration content`
            : undefined
        }
        size="wide"
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setDetailsOpen(false)}>
            Close
          </button>
        }
      >
        {selectedRegion && (
          <>
            <img
              src={selectedRegion.image}
              alt={`Illustrative forest landscape for ${selectedRegion.name}`}
              style={{ width: '100%', height: 210, objectFit: 'cover', borderRadius: 10 }}
            />
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12.8, lineHeight: 1.7, color: 'var(--text)' }}>
                {selectedRegion.description}
              </p>
              <h3 style={{ fontSize: 13.5, marginTop: 14, color: 'var(--green-900)' }}>
                Ecological importance
              </h3>
              <p style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--muted)', marginTop: 4 }}>
                {selectedRegion.importance}
              </p>
              <div className="region-facts" style={{ marginTop: 14 }}>
                <div className="region-fact">
                  <div className="k">Location</div>
                  <div className="v">{selectedRegion.location}</div>
                </div>
                <div className="region-fact">
                  <div className="k">Elevation</div>
                  <div className="v">{selectedRegion.elevation}</div>
                </div>
                <div className="region-fact">
                  <div className="k">Approximate area</div>
                  <div className="v">{formatArea(selectedRegion.areaKm2)}</div>
                </div>
                <div className="region-fact">
                  <div className="k">Forest cover</div>
                  <div className="v">{formatPercent(selectedRegion.forestCoverPercent)}</div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <DemoNotice>
                Illustrative region content for the VanaDrishti AI frontend demo.
              </DemoNotice>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
