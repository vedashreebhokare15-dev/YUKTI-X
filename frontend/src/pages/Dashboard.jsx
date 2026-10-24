import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Eye,
  Leaf,
  MapPin,
  Maximize2,
  Play,
  TreePine,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import FormField from '../components/common/FormField';
import DateRangeFilter from '../components/forms/DateRangeFilter';
import DemoNotice from '../components/common/DemoNotice';
import Modal from '../components/common/Modal';
import ChartCard from '../components/common/ChartCard';
import ForestMap from '../components/maps/ForestMap';
import ForestLossTrend from '../components/charts/ForestLossTrend';
import { useApp } from '../context/AppContext';
import {
  COMPOSITING_WINDOWS,
  getFeaturedRegion,
  getRegionById,
  getTrendData,
  REGION_SUMMARIES,
  STATES,
} from '../data/studyAreas';
import { mergeResults } from '../services/resultsService';
import { VEGETATION_INDICES } from '../data/vegetationIndices';
import {
  formatArea,
  formatDate,
  formatPercent,
  percentageOf,
} from '../utils/formatters';

const SUMMARY_ROWS = [
  { key: 'likely', label: 'Likely Forest Loss', color: '#EF4444' },
  { key: 'possible', label: 'Possible Forest Loss', color: '#F59E0B' },
  { key: 'noLoss', label: 'No Detected Loss', color: '#269B5B' },
  { key: 'insufficient', label: 'Insufficient Evidence', color: '#8A94A6' },
];

export default function Dashboard() {
  const { preferences, generatedResults, showToast } = useApp();
  const navigate = useNavigate();
  const preferenceRegion = getRegionById(preferences.defaultRegionId);
  const [selectedState, setSelectedState] = useState(preferenceRegion?.state || 'Maharashtra');
  const [startDate, setStartDate] = useState('2024-06-01');
  const [endDate, setEndDate] = useState('2024-11-30');
  const [compositingWindow, setCompositingWindow] = useState('3 months');
  const [errors, setErrors] = useState({});
  const [showDetections, setShowDetections] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedImage, setExpandedImage] = useState(null);

  const featuredRegion = getFeaturedRegion(selectedState);
  const summary = REGION_SUMMARIES[selectedState] || REGION_SUMMARIES.Maharashtra;
  const markers = useMemo(
    () => mergeResults(generatedResults).filter((result) => result.regionId === featuredRegion.id),
    [generatedResults, featuredRegion.id],
  );
  const trendData = useMemo(
    () => getTrendData(selectedState, compositingWindow),
    [selectedState, compositingWindow],
  );
  const activeIndexData = VEGETATION_INDICES[activeIndex];

  const validate = () => {
    const next = {};
    if (!startDate) next.start = 'Select a start date.';
    if (!endDate) next.end = 'Select an end date.';
    if (startDate && endDate && startDate > endDate) {
      next.end = 'End date cannot be before the start date.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRunAnalysis = () => {
    if (!validate()) {
      showToast({
        type: 'error',
        title: 'Check the date range',
        message: 'A valid start and end date are required before running an analysis.',
      });
      return;
    }
    const params = new URLSearchParams({
      state: selectedState,
      regionId: featuredRegion.id,
      start: startDate,
      end: endDate,
      window: compositingWindow,
    });
    navigate(`/analysis?${params.toString()}`);
    showToast({
      type: 'info',
      title: 'Analysis settings carried over',
      message: 'Review the demo workflow on the Analysis page and start the simulated run.',
    });
  };

  return (
    <>
      <PageHeader
        title="Welcome to VanaDrishti AI"
        subtitle="Monitor forest changes, detect potential loss and support conservation efforts using satellite imagery."
        meta={
          <>
            <span className="badge badge-info">
              <span className="dot" aria-hidden="true" />
              Demo workspace
            </span>
            <span className="chip neutral">
              <CalendarDays size={11} aria-hidden="true" />
              Sample window: {formatDate(startDate)} – {formatDate(endDate)}
            </span>
          </>
        }
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/study-area')}>
            <MapPin size={15} aria-hidden="true" />
            Manage study areas
          </button>
        }
      />

      <section className="card filter-bar" aria-label="Analysis filters">
        <FormField label="State / Region" htmlFor="dash-state">
          <select
            id="dash-state"
            className="select"
            value={selectedState}
            onChange={(event) => {
              setSelectedState(event.target.value);
              setErrors({});
            }}
          >
            {STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </FormField>

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

        <FormField label="Compositing Window" htmlFor="dash-window">
          <select
            id="dash-window"
            className="select"
            value={compositingWindow}
            onChange={(event) => setCompositingWindow(event.target.value)}
          >
            {COMPOSITING_WINDOWS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FormField>

        <div className="filter-button">
          <button type="button" className="btn btn-primary" onClick={handleRunAnalysis}>
            <Play size={14} aria-hidden="true" />
            Run Analysis
          </button>
        </div>
      </section>

      <div className="demo-note" style={{ marginTop: 10 }}>
        <Leaf size={13} aria-hidden="true" />
        Filters update the illustrative demo summaries and charts on this page. No satellite data is
        downloaded or processed by the frontend. The measured work is on{' '}
        <Link to="/model">Model</Link>, which reports the trained model scored on a region it never
        saw; the Earth Engine pipeline that produces those measurements runs in the backend
        repository, not in this page.
      </div>

      <div className="dash-main">
        <section className="card map-card" aria-labelledby="dashboard-map-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="dashboard-map-title">
                <MapPin size={16} aria-hidden="true" />
                Forest Study Area — {featuredRegion.name}
              </h2>
              <p className="card-subtitle">
                {featuredRegion.state} · Illustrative boundary with demo detections
              </p>
            </div>
            <div className="map-layer-toggles" role="group" aria-label="Map layers">
              <button
                type="button"
                className={`layer-chip ${showDetections ? 'active' : ''}`.trim()}
                onClick={() => setShowDetections((value) => !value)}
                aria-pressed={showDetections}
              >
                <span className="layer-dot" style={{ background: '#EF4444' }} aria-hidden="true" />
                <Eye size={11} aria-hidden="true" />
                Detections
              </button>
            </div>
          </div>
          <div className="map-card-body">
            <ForestMap
              center={featuredRegion.center}
              zoom={10}
              boundary={featuredRegion.boundary}
              markers={markers}
              showBoundary
              showLoss={showDetections}
              defaultBasemap={preferences.mapView}
            />
          </div>
        </section>

        <aside className="card summary-card" aria-labelledby="dashboard-summary-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="dashboard-summary-title">
                Analysis Summary
              </h2>
              <p className="card-subtitle">Sample classification totals</p>
            </div>
            <span className="chip">Demo</span>
          </div>
          <div className="card-body">
            <div className="summary-total">
              <div>
                <div className="summary-total-label">Total Study Area</div>
                <div className="summary-total-value">
                  {summary.total.toLocaleString('en-IN')}
                  <span>km²</span>
                </div>
              </div>
              <div className="summary-total-note">Illustrative demo landscape</div>
            </div>

            <div className="summary-list">
              {SUMMARY_ROWS.map((row) => {
                const value = summary[row.key];
                const pct = percentageOf(value, summary.total);
                return (
                  <div className="summary-row" key={row.key}>
                    <div className="summary-row-top">
                      <span className="summary-row-label">
                        <span
                          className="summary-row-dot"
                          style={{ background: row.color }}
                          aria-hidden="true"
                        />
                        {row.label}
                      </span>
                      <span className="summary-row-values">
                        <span className="summary-row-area">{formatArea(value)}</span>
                        <span className="summary-row-pct">{formatPercent(pct, 1)}</span>
                      </span>
                    </div>
                    <div className="summary-bar">
                      <div
                        className="summary-bar-fill"
                        style={{ width: `${Math.max(pct, 1.5)}%`, background: row.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="summary-meta">
              <div className="summary-meta-row">
                <span>Latest observation</span>
                <strong>{formatDate(summary.observationDate)}</strong>
              </div>
              <div className="summary-meta-row">
                <span>Analysis window</span>
                <strong>
                  {formatDate(startDate)} – {formatDate(endDate)}
                </strong>
              </div>
              <div className="summary-meta-row">
                <span>Composite window</span>
                <strong>{compositingWindow}</strong>
              </div>
              <div className="summary-meta-row">
                <span>Detections shown</span>
                <strong>{markers.length}</strong>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <DemoNotice>
                Illustrative demo values — not measured satellite results. Percentages are derived from
                the sample totals above.
              </DemoNotice>
            </div>
          </div>
        </aside>
      </div>

      <div className="dash-secondary">
        <section className="card" aria-labelledby="before-after-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="before-after-title">
                <CalendarDays size={16} aria-hidden="true" />
                Before &amp; After Comparison
              </h2>
              <p className="card-subtitle">Illustrative satellite-style views for the demo landscape</p>
            </div>
            <span className="chip warning">Sample imagery</span>
          </div>
          <div className="before-after-grid">
            <div className="image-panel">
              <img
                src="/assets/before-demo.png"
                alt="Illustrative satellite-style forest view labelled Before — not a real satellite observation"
                loading="lazy"
              />
              <div className="image-panel-top">
                <span className="image-tag">Before</span>
                <button
                  type="button"
                  className="image-expand"
                  aria-label="Expand the before sample image"
                  onClick={() =>
                    setExpandedImage({
                      title: 'Before observation',
                      src: '/assets/before-demo.png',
                      date: '12 Jun 2024',
                      caption: 'Dense canopy before the demo comparison window.',
                    })
                  }
                >
                  <Maximize2 size={13} />
                </button>
              </div>
              <div className="image-panel-bottom">
                <strong>Dense canopy</strong>
                <span>12 Jun 2024</span>
              </div>
            </div>

            <div className="image-panel">
              <img
                src="/assets/after-demo.png"
                alt="Illustrative satellite-style forest view labelled After — not a real satellite observation"
                loading="lazy"
              />
              <div className="image-panel-top">
                <span className="image-tag after">After</span>
                <button
                  type="button"
                  className="image-expand"
                  aria-label="Expand the after sample image"
                  onClick={() =>
                    setExpandedImage({
                      title: 'After observation',
                      src: '/assets/after-demo.png',
                      date: '18 Nov 2024',
                      caption: 'Simulated new clearings in the same demo landscape.',
                    })
                  }
                >
                  <Maximize2 size={13} />
                </button>
              </div>
              <div className="image-panel-bottom">
                <strong>Simulated clearing</strong>
                <span>18 Nov 2024</span>
              </div>
            </div>
          </div>
          <div className="image-sample-note">
            <TreePine size={12} aria-hidden="true" />
            Illustration only. These are generated sample images, not Sentinel-2 observations.
          </div>
        </section>

        <section className="card" aria-labelledby="vegetation-indices-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="vegetation-indices-title">
                <Leaf size={16} aria-hidden="true" />
                Vegetation Indices
              </h2>
              <p className="card-subtitle">Illustrative sample raster visualisations</p>
            </div>
            <span className="chip">Demo</span>
          </div>
          <div className="veg-tabs" style={{ padding: '12px 14px 0' }}>
            <div className="pill-tabs" role="tablist" aria-label="Vegetation index">
              {VEGETATION_INDICES.map((index, position) => (
                <button
                  key={index.id}
                  type="button"
                  className={`pill-tab ${position === activeIndex ? 'active' : ''}`.trim()}
                  onClick={() => setActiveIndex(position)}
                  role="tab"
                  aria-selected={position === activeIndex}
                  aria-controls="vegetation-index-panel"
                >
                  {index.label}
                </button>
              ))}
            </div>
          </div>
          <div className="veg-body" id="vegetation-index-panel" role="tabpanel">
            <div className="veg-image">
              <img
                src={activeIndexData.image}
                alt={`Illustrative ${activeIndexData.id} vegetation-index sample raster`}
                loading="lazy"
              />
              <span className="veg-image-tag">Illustrative {activeIndexData.id} raster</span>
            </div>
            <div className="veg-scale" aria-label={`${activeIndexData.id} colour scale`}>
              <div className="veg-scale-bar" aria-hidden="true" />
              <div className="veg-scale-labels">
                <span>{activeIndexData.scale.maxValue}</span>
                <span>0.5</span>
                <span>{activeIndexData.scale.minValue}</span>
              </div>
            </div>
          </div>
          <div className="veg-explainer">
            <Leaf size={13} aria-hidden="true" />
            <span>
              <strong>{activeIndexData.id}</strong> — {activeIndexData.fullName}.{' '}
              {activeIndexData.detail}
            </span>
          </div>
          <div style={{ padding: '0 14px 14px' }}>
            <DemoNotice>
              Sample raster only. Calculated NDVI / NDMI / NBR rasters will replace this visualisation
              once the processing backend is connected.
            </DemoNotice>
          </div>
        </section>
      </div>

      <ChartCard
        title="Forest Loss Trend"
        subtitle="Estimated area of potential forest loss over time"
        icon={Leaf}
        className="trend-card"
        actions={
          <>
            <span className="chip neutral">{compositingWindow} composite</span>
            <span className="chart-legend-line">
              <span aria-hidden="true" />
              Estimated affected area
            </span>
          </>
        }
        footer={
          <DemoNotice>
            Trend values are illustrative demo figures in km². They show how the chart will present
            backend-derived estimates of potential forest-loss area.
          </DemoNotice>
        }
      >
        <ForestLossTrend data={trendData} />
        <div style={{ padding: '0 18px 10px', fontSize: 11, color: 'var(--muted)' }}>
          The chart displays the estimated area of potential forest loss over the selected demo period.
        </div>
      </ChartCard>

      <Modal
        open={Boolean(expandedImage)}
        onClose={() => setExpandedImage(null)}
        title={expandedImage?.title || 'Sample image'}
        subtitle="Illustrative sample imagery — not a real satellite observation"
        size="wide"
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setExpandedImage(null)}>
            Close
          </button>
        }
      >
        {expandedImage && (
          <>
            <img
              src={expandedImage.src}
              alt={`Expanded illustrative ${expandedImage.title.toLowerCase()} of a forest landscape`}
              style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)' }}
            />
            <div className="row-between" style={{ marginTop: 10 }}>
              <span style={{ fontSize: 12.5, color: 'var(--heading)', fontWeight: 600 }}>
                {expandedImage.caption}
              </span>
              <span className="badge badge-neutral">{expandedImage.date}</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <DemoNotice>
                Generated sample imagery for interface demonstration. It does not represent a verified
                before/after satellite pair.
              </DemoNotice>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
