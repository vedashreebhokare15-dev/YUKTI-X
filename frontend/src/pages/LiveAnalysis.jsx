import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, MapPin, Play, RefreshCw } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import DemoNotice from '../components/common/DemoNotice';
import ForestMap from '../components/maps/ForestMap';
import { useApp } from '../context/AppContext';
import {
  classRows,
  inspectPoint,
  measurementGaps,
  qualityRows,
  runAnalysis,
  tileLayers,
} from '../services/backendService';
import { formatDateTime, formatNumber } from '../utils/formatters';

const MEASURED_LAYERS = [
  { name: 'class', label: 'Candidate loss classes' },
  { name: 'deviation', label: 'NDVI seasonal deviation' },
  { name: 'after_true_colour', label: 'After: true colour' },
  { name: 'before_true_colour', label: 'Before: true colour' },
  { name: 'ndvi', label: 'After NDVI' },
  { name: 'ndmi', label: 'After NDMI' },
  { name: 'nbr', label: 'After NBR' },
  { name: 'evidence', label: 'Valid observations' },
];

function zoomForBounds(bounds) {
  if (!bounds) return 9;
  const [[minLat, minLon], [maxLat, maxLon]] = bounds;
  const span = Math.max(Math.abs(maxLat - minLat), Math.abs(maxLon - minLon), 0.001);
  return Math.max(6, Math.min(13, Math.floor(Math.log2(360 / span)) - 1));
}

function centreOf(bounds) {
  if (!bounds) return [21.3, 77.35];
  const [[minLat, minLon], [maxLat, maxLon]] = bounds;
  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
}

function boundaryOf(region) {
  if (!region || !region.aoi) return null;
  return {
    type: 'Feature',
    properties: { name: region.name },
    geometry: { type: 'Polygon', coordinates: [region.aoi] },
  };
}

function valueOrNotMeasured(value, digits) {
  if (value === null || value === undefined) return 'no valid observation';
  if (typeof value === 'number') return formatNumber(value, digits);
  return String(value);
}

export default function LiveAnalysis() {
  const { backend, realRuns, registerRealRun, showToast } = useApp();
  const [regionKey, setRegionKey] = useState('');
  const [before, setBefore] = useState(['', '']);
  const [after, setAfter] = useState(['', '']);
  const [historyYears, setHistoryYears] = useState(3);
  const [cloudProbability, setCloudProbability] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [run, setRun] = useState(realRuns[0] || null);
  const [visibleTiles, setVisibleTiles] = useState(['class']);
  const [inspecting, setInspecting] = useState(false);
  const [sample, setSample] = useState(null);
  const timerRef = useRef(null);

  // Regions arrive from the backend's own configuration, so the study areas offered
  // here are exactly the ones the pipeline can run.
  const regions = backend.regions;
  // A region the backend marks as too large to force would sit on the request until
  // Earth Engine gives up, so the page opens on a region that can answer.
  const selected = useMemo(
    () => regions.find((region) => region.key === regionKey)
      || regions.find((region) => region.forcible)
      || regions[0]
      || null,
    [regions, regionKey],
  );

  useEffect(() => {
    if (!selected) return;
    const defaults = selected.defaults || {};
    setBefore(defaults.before || ['', '']);
    setAfter(defaults.after || ['', '']);
    setHistoryYears(defaults.history_years || 3);
    setRegionKey(selected.key);
  }, [selected]);

  useEffect(() => () => window.clearInterval(timerRef.current), []);

  const startTimer = () => {
    const started = Date.now();
    setElapsed(0);
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - started) / 1000));
    }, 1000);
  };

  const handleRun = async () => {
    if (!selected || running) return;
    setRunning(true);
    setError('');
    setSample(null);
    startTimer();
    try {
      const payload = await runAnalysis({
        region: selected.key,
        before,
        after,
        historyYears,
        useCloudProbability: cloudProbability,
      });
      setRun(payload);
      registerRealRun(payload);
      setVisibleTiles(['class']);
      showToast({
        type: 'success',
        title: 'Real run finished',
        message: `Earth Engine returned measured evidence for ${selected.name}.`,
      });
    } catch (requestError) {
      setError(requestError.message);
      showToast({
        type: 'error',
        title: 'Real run refused',
        message: requestError.message.slice(0, 160),
      });
    } finally {
      window.clearInterval(timerRef.current);
      setRunning(false);
    }
  };

  const handleInspect = useCallback(
    async (lat, lon) => {
      if (!run || !run.run_id || inspecting) return;
      setInspecting(true);
      try {
        setSample(await inspectPoint(run.run_id, lon, lat));
      } catch (inspectError) {
        setError(inspectError.message);
      } finally {
        setInspecting(false);
      }
    },
    [run, inspecting],
  );

  const layers = run ? tileLayers(run) : [];
  const classes = run ? classRows(run) : [];
  const quality = run ? qualityRows(run) : [];
  const gaps = run ? measurementGaps(run) : [];

  return (
    <>
      <PageHeader
        title="Live analysis"
        subtitle="Runs the Earth Engine pipeline and shows only what it measured. Nothing on this page is simulated."
        meta={
          <span className={`chip${backend.ready ? '' : ' warning'}`}>
            {backend.ready ? 'Earth Engine configured' : 'Earth Engine not configured'}
          </span>
        }
      />

      {!backend.configured && (
        <DemoNotice>
          No backend answered `/api/health`, so no real run can be started from this page. Start the
          server with an activated project (`python scripts/serve.py --project YOUR_PROJECT_ID`) and
          open the address it prints. ({backend.message})
        </DemoNotice>
      )}
      {backend.configured && !backend.ready && (
        <DemoNotice>
          {backend.message} Start the backend with an activated project
          (`python scripts/serve.py --project YOUR_PROJECT_ID`) and reload this page. Real runs stay
          disabled until then; the other pages continue to show illustrative demo data.
        </DemoNotice>
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Study region and windows</h2>
            <p className="card-subtitle">
              Regions come from the backend configuration. A window longer than 120 days or a
              baseline shorter than 3 seasons is refused by the same rules the pipeline uses.
            </p>
          </div>
        </div>
        <div className="card-body">
          {regions.length === 0 ? (
            <p className="live-muted">No regions could be fetched.</p>
          ) : (
            <div className="live-form">
              <label className="form-field">
                <span className="form-label">Study region</span>
                <select className="select" value={selected ? selected.key : ''}
                        onChange={(event) => setRegionKey(event.target.value)}>
                  {regions.map((region) => (
                    <option key={region.key} value={region.key}>
                      {region.name}
                      {region.area_km2 ? ` — ${region.area_km2} km2` : ''}
                      {region.forcible === false ? ' (too large for one request today)' : ''}
                    </option>
                  ))}
                </select>
                {selected && <span className="live-why">{selected.why}</span>}
              </label>
              <label className="form-field">
                <span className="form-label">Before start</span>
                <input className="input" type="date" value={before[0]}
                       onChange={(event) => setBefore([event.target.value, before[1]])} />
              </label>
              <label className="form-field">
                <span className="form-label">Before end</span>
                <input className="input" type="date" value={before[1]}
                       onChange={(event) => setBefore([before[0], event.target.value])} />
              </label>
              <label className="form-field">
                <span className="form-label">After start</span>
                <input className="input" type="date" value={after[0]}
                       onChange={(event) => setAfter([event.target.value, after[1]])} />
              </label>
              <label className="form-field">
                <span className="form-label">After end</span>
                <input className="input" type="date" value={after[1]}
                       onChange={(event) => setAfter([after[0], event.target.value])} />
              </label>
              <label className="form-field">
                <span className="form-label">Baseline seasons</span>
                <input className="input" type="number" min="3" max="6" value={historyYears}
                       onChange={(event) => setHistoryYears(Number(event.target.value))} />
              </label>
              <label className="form-field form-field-check">
                <span className="form-label">Cloud screening</span>
                <button
                  type="button"
                  className={`chip${cloudProbability ? '' : ' warning'}`}
                  onClick={() => setCloudProbability(!cloudProbability)}
                  aria-pressed={cloudProbability}
                >
                  {cloudProbability ? 'Sentinel-2 cloud probability' : 'QA60 flags only'}
                </button>
              </label>
              <div className="live-actions">
                <button type="button" className="btn btn-primary" onClick={handleRun}
                        disabled={!backend.ready || running || !selected
                                 || selected.forcible === false}>
                  {running ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
                  {running ? `Running on Earth Engine (${elapsed} s)` : 'Run real analysis'}
                </button>
                {selected?.forcible === false ? (
                  <span className="live-note">
                    {selected.name} covers {selected.area_km2} km2. Measured on 2026-10-25: a single
                    Sentinel-2 composite forced over the 688 km2 pilot box had still not returned
                    after 14 minutes, so this region cannot be run as one request today. Run the
                    28 km2 slice inside it, or reduce the box in forestguard/config.py.
                  </span>
                ) : (
                  <span className="live-note">
                    This is one synchronous Earth Engine request over every seasonal composite the
                    run needs. It takes minutes, and the stages are not invented here.
                  </span>
                )}
              </div>
            </div>
          )}
          {error && (
            <p className="live-error">
              <AlertTriangle size={14} aria-hidden="true" /> {error}
            </p>
          )}
        </div>
      </section>

      {run && (
        <>
          <section className="card map-card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Measured evidence layers</h2>
                <p className="card-subtitle">
                  Run {run.run_id} · {run.provenance?.study_region || selected?.name} · generated{' '}
                  {formatDateTime(run.provenance?.generated_utc)}
                </p>
              </div>
              <div className="map-layer-toggles">
                {MEASURED_LAYERS.map((layer) => (
                  <button
                    key={layer.name}
                    type="button"
                    className={visibleTiles.includes(layer.name) ? 'chip' : 'chip neutral'}
                    onClick={() => setVisibleTiles((current) => (
                      current.includes(layer.name)
                        ? current.filter((name) => name !== layer.name)
                        : [...current, layer.name]
                    ))}
                    aria-pressed={visibleTiles.includes(layer.name)}
                  >
                    <span className="layer-dot" aria-hidden="true" />
                    {layer.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="map-card-body">
              <ForestMap
                center={centreOf(run.bounds)}
                zoom={zoomForBounds(run.bounds)}
                markers={[]}
                boundary={boundaryOf(regions.find((region) => region.key === run.region) || selected)}
                showBoundary
                tileLayers={layers}
                visibleTiles={visibleTiles}
                onMapClick={handleInspect}
                dataMode="real"
                height="520px"
              />
              <p className="live-hint">
                <MapPin size={13} aria-hidden="true" /> Click the map to read one 20 m cell back from
                the same evidence image that produced these tiles.
              </p>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Cell inspector</h2>
                <p className="card-subtitle">
                  Values are the composited measurement, not a probability.
                </p>
              </div>
            </div>
            <div className="card-body">
              {!sample && <p className="live-muted">No cell read yet. Click the map above.</p>}
              {sample && (
                <div className="live-inspector">
                  <p className="live-inspector-head">
                    <Activity size={14} aria-hidden="true" />
                    <strong>{sample.label}</strong>
                    <span className="live-muted">
                      at {sample.lon.toFixed(5)}, {sample.lat.toFixed(5)}
                    </span>
                  </p>
                  <p className="live-reason">{sample.reason}</p>
                  <dl className="live-values">
                    <div><dt>NDVI before</dt><dd>{valueOrNotMeasured(sample.ndvi_before, 3)}</dd></div>
                    <div><dt>NDVI after</dt><dd>{valueOrNotMeasured(sample.ndvi_current, 3)}</dd></div>
                    <div><dt>Seasonal expectation</dt><dd>{valueOrNotMeasured(sample.ndvi_baseline, 3)}</dd></div>
                    <div><dt>Deviation (sigma)</dt><dd>{valueOrNotMeasured(sample.deviation_sigma, 2)}</dd></div>
                    <div><dt>NDMI deviation</dt><dd>{valueOrNotMeasured(sample.ndmi_deviation_sigma, 2)}</dd></div>
                    <div><dt>NBR deviation</dt><dd>{valueOrNotMeasured(sample.nbr_deviation_sigma, 2)}</dd></div>
                    <div><dt>Valid scenes before</dt><dd>{valueOrNotMeasured(sample.valid_obs_before)}</dd></div>
                    <div><dt>Valid scenes after</dt><dd>{valueOrNotMeasured(sample.valid_obs_after)}</dd></div>
                    <div><dt>Seasons in baseline</dt><dd>{valueOrNotMeasured(sample.seasons_in_baseline)}</dd></div>
                    <div><dt>Historical forest gate</dt><dd>{sample.historical_forest === null ? 'unknown' : String(sample.historical_forest)}</dd></div>
                    <div><dt>Supporting index agrees</dt><dd>{sample.supporting_index_agrees === null ? 'unknown' : String(sample.supporting_index_agrees)}</dd></div>
                    <div><dt>Persistence confirmed</dt><dd>not measured</dd></div>
                  </dl>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">What the run counted</h2>
                <p className="card-subtitle">
                  Cells and hectares come from the class histogram of this run at{' '}
                  {run.provenance?.grid?.nominal_resolution_m || 20} m. They are candidate signal
                  areas, not forest statistics.
                </p>
              </div>
            </div>
            <div className="card-body table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Rule state</th><th>20 m cells</th><th>Hectares</th></tr>
                </thead>
                <tbody>
                  {classes.map((row) => (
                    <tr key={row.key}>
                      <td className="cell-strong">
                        <span className="live-class-swatch" style={{ background: row.colour }} aria-hidden="true" />
                        {' '}
                        {row.label}
                      </td>
                      <td>{formatNumber(row.cells)}</td>
                      <td>{row.hectares === null ? 'not measured' : `${formatNumber(row.hectares, 2)} ha`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Scene quality per window</h2>
                <p className="card-subtitle">
                  Every window the run composited, with the scenes that survived cloud and shadow
                  screening.
                </p>
              </div>
            </div>
            <div className="card-body table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Window</th><th>Dates</th><th>Scenes found</th><th>Usable</th>
                    <th>Cloud %</th><th>Coverage of cells</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {quality.map((row) => (
                    <tr key={row.name}>
                      <td className="cell-strong">{row.name}</td>
                      <td>{row.window || '—'}</td>
                      <td>{row.scenes_found ?? 'not measured'}</td>
                      <td>{row.scenes_usable ?? 'not measured'}</td>
                      <td>
                        {row.cloud_percentage && row.cloud_percentage.mean !== undefined
                          ? `${formatNumber(row.cloud_percentage.mean, 1)} % mean`
                          : 'not measured'}
                      </td>
                      <td>
                        {row.coverage && row.coverage.sufficient_share !== undefined
                          ? `${formatNumber(row.coverage.sufficient_share * 100, 1)} %`
                          : 'not measured'}
                      </td>
                      <td>
                        <span className={`chip${row.reportable ? '' : ' warning'}`}>
                          {row.status || (row.reportable ? 'reportable' : 'not reportable')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Provenance and what is not measured</h2>
              </div>
            </div>
            <div className="card-body">
              <ul className="live-provenance">
                <li><strong>Origin:</strong> {run.provenance?.origin}</li>
                <li><strong>Classifier:</strong> {run.provenance?.classifier}</li>
                <li><strong>Forest definition:</strong> {run.provenance?.forest_definition}</li>
                <li><strong>Boundary:</strong> {run.provenance?.aoi_note}</li>
                <li><strong>Datasets:</strong> {(run.provenance?.datasets || []).join(', ')}</li>
                <li><strong>Area basis:</strong> {run.provenance?.grid?.area_note}</li>
                <li>
                  <strong>Thresholds:</strong>{' '}
                  {Object.entries(run.provenance?.thresholds || {}).map(([key, value]) =>
                    `${key} ${value}`).join(', ')}
                </li>
              </ul>
              <ul className="live-gaps">
                {gaps.map((gap) => <li key={gap}>{gap}</li>)}
              </ul>
            </div>
          </section>
        </>
      )}

      {realRuns.length > 1 && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Earlier real runs</h2>
              <p className="card-subtitle">
                Tile URLs from Earth Engine expire, so an older run may stop drawing layers.
              </p>
            </div>
          </div>
          <div className="card-body table-wrap">
            <table className="data-table">
              <thead><tr><th>Run</th><th>Region</th><th>Generated</th><th></th></tr></thead>
              <tbody>
                {realRuns.map((row) => (
                  <tr key={row.run_id}>
                    <td className="cell-strong">{row.run_id.slice(0, 8)}</td>
                    <td>{row.provenance?.study_region || '—'}</td>
                    <td>{formatDateTime(row.provenance?.generated_utc)}</td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm"
                              onClick={() => setRun(row)}>Show</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
