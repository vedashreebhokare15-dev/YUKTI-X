import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  Eye,
  FileJson,
  FileText,
  Gauge,
  Map as MapIcon,
  MapPin,
  Play,
  Search,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import MetricCard from '../components/common/MetricCard';
import DemoNotice from '../components/common/DemoNotice';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import DataTable from '../components/common/DataTable';
import Pagination from '../components/common/Pagination';
import StatusBadge from '../components/common/StatusBadge';
import ExportButton from '../components/common/ExportButton';
import ChartCard from '../components/common/ChartCard';
import ResultBreakdown from '../components/charts/ResultBreakdown';
import ForestMap from '../components/maps/ForestMap';
import { useApp } from '../context/AppContext';
import {
  CLASSIFICATIONS,
  getClassificationColor,
  getRegionById,
} from '../data/studyAreas';
import { mergeResults } from '../services/resultsService';
import {
  formatArea,
  formatConfidence,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  percentageOf,
} from '../utils/formatters';
import { downloadCsv, RESULT_COLUMNS, RUN_COLUMNS } from '../utils/exportCsv';
import { exportResultsGeoJSON } from '../utils/exportGeoJSON';

const PAGE_SIZE = 6;

const RESULT_DATE_RANGES = [
  { id: 'all', label: 'All dates', from: null, to: null },
  { id: 'q3-2024', label: 'Jul – Sep 2024', from: '2024-07-01', to: '2024-09-30' },
  { id: 'q4-2024', label: 'Oct – Dec 2024', from: '2024-10-01', to: '2024-12-31' },
  { id: 'y2024', label: 'Full year 2024', from: '2024-01-01', to: '2024-12-31' },
];

function sortValue(result, key) {
  if (key === 'areaKm2' || key === 'confidence') return result[key];
  if (key === 'city' || key === 'location') return result.location;
  return result[key];
}

export default function Results() {
  const { generatedResults, analysisRuns, showToast } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const results = useMemo(() => mergeResults(generatedResults), [generatedResults]);
  const focusRunParam = searchParams.get('run');
  const focusRun = useMemo(
    () => analysisRuns.find((run) => run.id === focusRunParam) || null,
    [analysisRuns, focusRunParam],
  );

  const initialRegion = searchParams.get('region') || 'all';
  const [regionFilter, setRegionFilter] = useState(() => {
    if (initialRegion === 'all') return 'all';
    return results.some((result) => result.regionId === initialRegion) ? initialRegion : 'all';
  });
  const [dateRange, setDateRange] = useState('all');
  const [classification, setClassification] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'observationDate', direction: 'desc' });
  const [selectedId, setSelectedId] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [runModal, setRunModal] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [regionFilter, dateRange, classification, query]);

  const regionOptions = useMemo(() => {
    const map = new Map();
    results.forEach((result) => {
      if (result.regionId && !map.has(result.regionId)) {
        map.set(result.regionId, result.regionName);
      }
    });
    analysisRuns.forEach((run) => {
      if (run.regionId && !map.has(run.regionId)) {
        map.set(run.regionId, run.regionName);
      }
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [results, analysisRuns]);

  const filteredResults = useMemo(() => {
    const search = query.trim().toLowerCase();
    const range = RESULT_DATE_RANGES.find((item) => item.id === dateRange) || RESULT_DATE_RANGES[0];
    return results.filter((result) => {
      if (regionFilter !== 'all' && result.regionId !== regionFilter) return false;
      if (classification !== 'all' && result.classification !== classification) return false;
      if (search) {
        const haystack = `${result.location} ${result.district} ${result.state} ${result.regionName}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (range.from && result.observationDate < range.from) return false;
      if (range.to && result.observationDate > range.to) return false;
      return true;
    });
  }, [results, regionFilter, classification, query, dateRange]);

  const sortedResults = useMemo(() => {
    const sorted = [...filteredResults];
    sorted.sort((a, b) => {
      const valueA = sortValue(a, sort.key);
      const valueB = sortValue(b, sort.key);
      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return 1;
      if (valueB == null) return -1;
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sort.direction === 'asc' ? valueA - valueB : valueB - valueA;
      }
      const comparison = String(valueA).localeCompare(String(valueB), 'en', { numeric: true });
      return sort.direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredResults, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedResults.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedResults = sortedResults.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const likelyArea = filteredResults
    .filter((result) => result.classification === 'Likely Forest Loss')
    .reduce((total, result) => total + result.areaKm2, 0);
  const needsReview = filteredResults.filter(
    (result) => result.status === 'Review' || result.status === 'Needs Review',
  ).length;
  const averageConfidence = filteredResults.length
    ? filteredResults.reduce((total, result) => total + result.confidence, 0) /
      filteredResults.length
    : 0;

  const breakdownData = CLASSIFICATIONS.map((name) => ({
    name,
    value: filteredResults
      .filter((result) => result.classification === name)
      .reduce((total, result) => total + result.areaKm2, 0),
    color: getClassificationColor(name),
  }));
  const breakdownTotal = breakdownData.reduce((total, item) => total + item.value, 0);

  const selectedResult =
    filteredResults.find((result) => result.id === selectedId) || filteredResults[0] || null;
  const selectedRegion = selectedResult ? getRegionById(selectedResult.regionId) : null;

  const exportCsv = () => {
    if (filteredResults.length === 0) {
      showToast({
        type: 'warning',
        title: 'Nothing to export',
        message: 'Adjust the filters so at least one demo result is visible.',
      });
      return;
    }
    downloadCsv('vanadrishti-demo-results', RESULT_COLUMNS, filteredResults);
    showToast({
      type: 'success',
      title: 'CSV exported',
      message: `${filteredResults.length} illustrative result rows were downloaded.`,
    });
  };

  const exportGeoJson = () => {
    if (filteredResults.length === 0) {
      showToast({
        type: 'warning',
        title: 'Nothing to export',
        message: 'Adjust the filters so at least one demo result is visible.',
      });
      return;
    }
    exportResultsGeoJSON(filteredResults, 'vanadrishti-demo-results');
    showToast({
      type: 'success',
      title: 'GeoJSON exported',
      message: 'Point features for the filtered demo results were downloaded.',
    });
  };

  const downloadResultDetails = (result) => {
    downloadCsv(`vanadrishti-result-${result.id}`, RESULT_COLUMNS, [result]);
    showToast({
      type: 'success',
      title: 'Result details downloaded',
      message: `${result.location} was exported as a single-row CSV.`,
    });
  };

  const downloadRun = (run) => {
    downloadCsv(`vanadrishti-demo-run-${run.id}`, RUN_COLUMNS, [run]);
    showToast({
      type: 'success',
      title: 'Run metadata downloaded',
      message: `${run.id} was exported as CSV. No satellite files are included.`,
    });
  };

  const columns = [
    {
      key: 'location',
      label: 'Location / District',
      sortable: true,
      render: (result) => (
        <div className="table-location">
          <span
            className="table-location-dot"
            style={{ background: getClassificationColor(result.classification) }}
            aria-hidden="true"
          />
          <div className="table-location-copy">
            <div className="cell-strong">{result.location}</div>
            <div className="cell-muted">
              {result.district}, {result.state}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'classification',
      label: 'Detected Change',
      render: (result) => <StatusBadge value={result.classification} />,
    },
    {
      key: 'areaKm2',
      label: 'Area (km²)',
      align: 'right',
      sortable: true,
      render: (result) => (
        <span className="num-cell">{formatNumber(result.areaKm2, 1)}</span>
      ),
    },
    {
      key: 'confidence',
      label: 'Confidence',
      align: 'right',
      sortable: true,
      render: (result) => (
        <span className="confidence-cell">
          <span className="confidence-track" aria-hidden="true">
            <span
              className="confidence-fill"
              style={{ width: `${Math.round(result.confidence * 100)}%` }}
            />
          </span>
          <span className="num-cell">{formatConfidence(result.confidence)}</span>
        </span>
      ),
    },
    {
      key: 'observationDate',
      label: 'Observation Date',
      sortable: true,
      render: (result) => formatDate(result.observationDate),
    },
    {
      key: 'status',
      label: 'Status',
      render: (result) => <StatusBadge value={result.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (result) => (
        <div className="btn-group" style={{ justifyContent: 'flex-end', gap: 4 }}>
          <button
            type="button"
            className="icon-btn plain"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedId(result.id);
              setMapOpen(true);
            }}
            aria-label={`View ${result.location} on the map`}
            title="View details on map"
          >
            <Eye size={14} />
          </button>
          <button
            type="button"
            className="icon-btn plain"
            onClick={(event) => {
              event.stopPropagation();
              downloadResultDetails(result);
            }}
            aria-label={`Download details for ${result.location}`}
            title="Download details"
          >
            <Download size={14} />
          </button>
        </div>
      ),
    },
  ];

  const runColumns = [
    {
      key: 'id',
      label: 'Run ID',
      render: (run) => <span className="cell-strong">{run.id}</span>,
    },
    {
      key: 'regionName',
      label: 'Region',
      render: (run) => (
        <div>
          <div className="cell-strong">{run.regionName}</div>
          <div className="cell-muted">{run.state}</div>
        </div>
      ),
    },
    {
      key: 'startDate',
      label: 'Date Range',
      render: (run) => `${formatDate(run.startDate)} – ${formatDate(run.endDate)}`,
    },
    {
      key: 'classification',
      label: 'Classification',
      render: (run) => <StatusBadge value={run.classification} />,
    },
    {
      key: 'findings',
      label: 'Findings',
      align: 'right',
      render: (run) => <span className="num-cell">{run.findings}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (run) => <StatusBadge value={run.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (run) => (
        <div className="btn-group" style={{ justifyContent: 'flex-end', gap: 4 }}>
          <button
            type="button"
            className="icon-btn plain"
            onClick={() => setRunModal(run)}
            aria-label={`View ${run.id}`}
            title="View run"
          >
            <Eye size={14} />
          </button>
          <button
            type="button"
            className="icon-btn plain"
            onClick={() => downloadRun(run)}
            aria-label={`Download ${run.id}`}
            title="Download run metadata"
          >
            <Download size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Forest Loss Analysis Results"
        subtitle="Review detected changes, confidence levels, and downloadable outputs."
        meta={
          <>
            <span className="badge badge-info">
              <span className="dot" aria-hidden="true" />
              Illustrative records
            </span>
            <span className="chip neutral">{results.length} demo findings available</span>
          </>
        }
        actions={
          <>
            <ExportButton
              label="Export"
              options={[
                { label: 'Download CSV', icon: FileText, onSelect: exportCsv },
                { label: 'Download GeoJSON', icon: FileJson, onSelect: exportGeoJson },
              ]}
            />
            <button type="button" className="btn btn-primary" onClick={() => navigate('/analysis')}>
              <Play size={14} aria-hidden="true" />
              New Analysis
            </button>
          </>
        }
      />

      <section className="card filter-bar" aria-label="Result filters">
        <div className="form-field">
          <label className="form-label" htmlFor="results-region">
            Region
          </label>
          <select
            id="results-region"
            className="select"
            value={regionFilter}
            onChange={(event) => setRegionFilter(event.target.value)}
          >
            <option value="all">All regions</option>
            {regionOptions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="results-date-range">
            Date Range
          </label>
          <select
            id="results-date-range"
            className="select"
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value)}
          >
            {RESULT_DATE_RANGES.map((range) => (
              <option key={range.id} value={range.id}>
                {range.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="results-classification">
            Classification
          </label>
          <select
            id="results-classification"
            className="select"
            value={classification}
            onChange={(event) => setClassification(event.target.value)}
          >
            <option value="all">All Categories</option>
            {CLASSIFICATIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-button">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setRegionFilter('all');
              setDateRange('all');
              setClassification('all');
              setQuery('');
            }}
          >
            Reset filters
          </button>
        </div>
      </section>

      {focusRun && (
        <div className="demo-note" style={{ marginTop: 10 }}>
          <CheckCircle2 size={13} aria-hidden="true" />
          <span>
            Demo run <strong>{focusRun.id}</strong> for {focusRun.regionName} was generated locally and
            is included in the results below.{' '}
            <button type="button" className="link-btn" onClick={() => setRunModal(focusRun)}>
              View run details
            </button>
          </span>
        </div>
      )}

      <div className="metrics-grid results-section">
        <MetricCard
          icon={ClipboardList}
          label="Total Findings"
          value={filteredResults.length}
          help="Rows in the current filtered view"
          tone="teal"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Likely Loss Area"
          value={formatNumber(likelyArea, 1)}
          unit="km²"
          help="Sum of likely-loss demo polygons"
          tone="red"
        />
        <MetricCard
          icon={ClipboardCheck}
          label="Needs Review"
          value={needsReview}
          help="Flagged for manual review or field check"
          tone="amber"
        />
        <MetricCard
          icon={Gauge}
          label="Average Confidence"
          value={filteredResults.length ? Math.round(averageConfidence * 100) : '—'}
          unit={filteredResults.length ? '%' : ''}
          help="Mean confidence of displayed demo rows"
          tone="blue"
        />
      </div>

      <section className="card results-section" aria-labelledby="results-table-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="results-table-title">
              <MapPin size={16} aria-hidden="true" />
              Analysis Results
            </h2>
            <p className="card-subtitle">
              Sample and generated records. Sort by area, confidence or observation date.
            </p>
          </div>
          <span className="chip">Demo data</span>
        </div>
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="search-input">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                className="input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by location, district or state"
                aria-label="Search results by location"
              />
            </div>
          </div>
          <div className="table-toolbar-right">
            <span className="table-count">
              {filteredResults.length} of {results.length} demo findings
            </span>
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={pagedResults}
          sort={sort}
          onSortChange={setSort}
          selectedKey={selectedResult?.id || null}
          onRowClick={(result) => setSelectedId(result.id)}
          emptyTitle="No results match these filters"
          emptyMessage="Try a different region, date range, classification or search term."
          emptyIcon={Search}
          caption="Forest loss analysis results"
        />
        <Pagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={filteredResults.length}
          onChange={setPage}
          itemLabel="findings"
        />
      </section>

      <div className="results-lower">
        <ChartCard
          title="Result Breakdown"
          subtitle="Classification area for the filtered demo rows"
          icon={MapIcon}
          actions={<span className="chip">Illustrative</span>}
          footer={
            <DemoNotice>
              Percentages are computed from the categories currently displayed. These areas are
              illustrative sample figures, not verified satellite measurements.
            </DemoNotice>
          }
        >
          <div style={{ padding: '14px 16px' }}>
            {filteredResults.length > 0 ? (
              <ResultBreakdown data={breakdownData} total={breakdownTotal} />
            ) : (
              <EmptyState
                icon={Search}
                title="No breakdown available"
                message="No demo findings match the current filters."
              />
            )}
          </div>
        </ChartCard>

        <section className="card" aria-labelledby="selected-result-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="selected-result-title">
                <MapPin size={16} aria-hidden="true" />
                Selected Result
              </h2>
              <p className="card-subtitle">Details for the highlighted demo finding</p>
            </div>
            {selectedResult && <StatusBadge value={selectedResult.classification} />}
          </div>
          <div className="card-body">
            {selectedResult ? (
              <>
                <div className="result-detail-thumb">
                  <img
                    src="/assets/satellite-demo.png"
                    alt={`Illustrative satellite-style thumbnail for ${selectedResult.location} — not a real satellite observation`}
                    loading="lazy"
                  />
                  <div className="result-detail-thumb-overlay">
                    <span>{selectedResult.location}</span>
                    <span>Illustrative thumbnail</span>
                  </div>
                </div>

                <div className="result-detail-grid">
                  <div className="result-detail-item">
                    <div className="k">District</div>
                    <div className="v">{selectedResult.district}</div>
                  </div>
                  <div className="result-detail-item">
                    <div className="k">State</div>
                    <div className="v">{selectedResult.state}</div>
                  </div>
                  <div className="result-detail-item">
                    <div className="k">Change category</div>
                    <div className="v">{selectedResult.classification}</div>
                  </div>
                  <div className="result-detail-item">
                    <div className="k">Confidence</div>
                    <div className="v">{formatConfidence(selectedResult.confidence)}</div>
                  </div>
                  <div className="result-detail-item">
                    <div className="k">Area</div>
                    <div className="v">{formatArea(selectedResult.areaKm2)}</div>
                  </div>
                  <div className="result-detail-item">
                    <div className="k">Observation date</div>
                    <div className="v">{formatDate(selectedResult.observationDate)}</div>
                  </div>
                </div>

                <p style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--muted)', marginTop: 12 }}>
                  {selectedResult.summary}
                </p>

                <div className="result-detail-foot">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setMapOpen(true)}
                  >
                    <MapIcon size={13} aria-hidden="true" />
                    View on Map
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => downloadResultDetails(selectedResult)}
                  >
                    <Download size={13} aria-hidden="true" />
                    Download Details
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <DemoNotice>
                    This record is illustrative sample data. Classification, area and confidence are
                    not the output of a verified Sentinel-2 analysis run.
                  </DemoNotice>
                </div>
              </>
            ) : (
              <EmptyState
                icon={MapPin}
                title="No result selected"
                message="Adjust the filters to display a demo finding and its details."
              />
            )}
          </div>
        </section>
      </div>

      <section className="card results-section" aria-labelledby="recent-runs-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="recent-runs-title">
              <ClipboardList size={16} aria-hidden="true" />
              Recent Analysis Runs
            </h2>
            <p className="card-subtitle">
              Sample history and demonstration runs saved in this browser
            </p>
          </div>
          <span className="chip neutral">{analysisRuns.length} runs</span>
        </div>
        <DataTable
          columns={runColumns}
          rows={analysisRuns.slice(0, 8)}
          emptyTitle="No analysis runs yet"
          emptyMessage="Completed demo workflows will be listed here."
          emptyIcon={ClipboardList}
          caption="Recent analysis runs"
        />
        <div className="card-foot">
          <DemoNotice>
            Seed runs are demonstration records. New runs are generated by the simulated frontend
            workflow and stored locally — no satellite processing occurs.
          </DemoNotice>
        </div>
      </section>

      <Modal
        open={mapOpen && Boolean(selectedResult)}
        onClose={() => setMapOpen(false)}
        title={selectedResult ? selectedResult.location : 'Result map'}
        subtitle={
          selectedResult
            ? `${selectedResult.district}, ${selectedResult.state} · illustrative demo detection`
            : undefined
        }
        size="wide"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setMapOpen(false)}>
              Close
            </button>
            {selectedResult && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => downloadResultDetails(selectedResult)}
              >
                <Download size={14} aria-hidden="true" />
                Download Details
              </button>
            )}
          </>
        }
      >
        {selectedResult && (
          <>
            <div
              style={{
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid var(--border)',
              }}
            >
              <ForestMap
                center={selectedResult.coordinates}
                zoom={12}
                boundary={selectedRegion?.boundary}
                forestPatches={selectedRegion?.forestPatches}
                markers={[selectedResult]}
                showBoundary={Boolean(selectedRegion)}
                showForestCover
                showLoss
                showLegend={false}
                height={330}
              />
            </div>
            <div className="row-between" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <StatusBadge value={selectedResult.classification} />
                <StatusBadge value={selectedResult.status} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                Observed {formatDate(selectedResult.observationDate)} ·{' '}
                {formatConfidence(selectedResult.confidence)} confidence
              </span>
            </div>
            <div style={{ marginTop: 10 }}>
              <DemoNotice>
                Marker and map layers are illustrative demonstration geometry. They are not verified
                Sentinel-2 detections or official forest boundaries.
              </DemoNotice>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={Boolean(runModal)}
        onClose={() => setRunModal(null)}
        title={runModal ? `Analysis run ${runModal.id}` : 'Analysis run'}
        subtitle={runModal ? `${runModal.regionName} · ${runModal.state}` : undefined}
        size="wide"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRunModal(null)}>
              Close
            </button>
            {runModal && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => downloadRun(runModal)}
              >
                <Download size={14} aria-hidden="true" />
                Download Run CSV
              </button>
            )}
          </>
        }
      >
        {runModal && (
          <>
            <div className="row-between" style={{ gap: 10, flexWrap: 'wrap' }}>
              <StatusBadge value={runModal.status} />
              <span className="badge badge-info">
                <span className="dot" aria-hidden="true" />
                Simulated demo run
              </span>
            </div>
            <div className="region-facts" style={{ marginTop: 12 }}>
              <div className="region-fact">
                <div className="k">Region</div>
                <div className="v">{runModal.regionName}</div>
              </div>
              <div className="region-fact">
                <div className="k">Date range</div>
                <div className="v">
                  {formatDate(runModal.startDate)} – {formatDate(runModal.endDate)}
                </div>
              </div>
              <div className="region-fact">
                <div className="k">Algorithm</div>
                <div className="v">{runModal.algorithm}</div>
              </div>
              <div className="region-fact">
                <div className="k">Confidence threshold</div>
                <div className="v">{formatPercent(runModal.confidenceThreshold * 100)}</div>
              </div>
              <div className="region-fact">
                <div className="k">Compositing window</div>
                <div className="v">{runModal.compositingWindow}</div>
              </div>
              <div className="region-fact">
                <div className="k">Findings</div>
                <div className="v">{runModal.findings}</div>
              </div>
            </div>
            {runModal.summary && (
              <div className="summary-list" style={{ marginTop: 14 }}>
                {[
                  { key: 'likely', label: 'Likely Forest Loss', color: '#EF4444' },
                  { key: 'possible', label: 'Possible Forest Loss', color: '#F59E0B' },
                  { key: 'noLoss', label: 'No Detected Loss', color: '#269B5B' },
                  { key: 'insufficient', label: 'Insufficient Evidence', color: '#8A94A6' },
                ].map((row) => (
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
                        <span className="summary-row-area">{formatArea(runModal.summary[row.key])}</span>
                        <span className="summary-row-pct">
                          {formatPercent(percentageOf(runModal.summary[row.key], runModal.summary.total))}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
              Created {formatDateTime(runModal.createdAt)}. This run is a frontend demonstration and
              does not contain processed satellite data.
            </p>
            <div style={{ marginTop: 10 }}>
              <DemoNotice>
                Download includes run metadata only. Real scene lists, indices and detected polygons
                will come from the future processing backend.
              </DemoNotice>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
