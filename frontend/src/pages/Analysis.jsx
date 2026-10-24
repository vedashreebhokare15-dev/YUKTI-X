import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Check,
  Clock3,
  Cloud,
  Cpu,
  Info,
  Layers,
  MapPin,
  Play,
  RotateCcw,
  Satellite,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import FormField from '../components/common/FormField';
import RegionSelector from '../components/forms/RegionSelector';
import DateRangeFilter from '../components/forms/DateRangeFilter';
import DemoNotice from '../components/common/DemoNotice';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import ToggleSwitch from '../components/common/ToggleSwitch';
import { useApp } from '../context/AppContext';
import {
  COMPOSITING_WINDOWS,
  getFeaturedRegion,
  getRegionById,
  getRegionsForDistrict,
  getDistricts,
} from '../data/studyAreas';
import {
  ALGORITHMS,
  BASELINE_PERIODS,
  COMPOSITING_METHODS,
  SEASONAL_WINDOWS,
  WORKFLOW_STEPS,
} from '../data/analysisRuns';
import { createDemoRunOutput } from '../services/analysisService';
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

const DEFAULT_SETTINGS = {
  cloudProbability: true,
  cloudShadows: true,
  cirrus: false,
  compositingMethod: 'Median with quality filtering',
  baselinePeriod: 'Past 3 years',
  seasonalWindow: 'Same season ± 1 month',
  algorithm: 'Random Forest',
  confidenceThreshold: 0.82,
};

function SettingsCard({ icon: Icon, title, subtitle, badge, children, note }) {
  return (
    <section className="card settings-card">
      <div className="card-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span className="settings-card-icon" aria-hidden="true">
            <Icon size={15} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 className="card-title">{title}</h2>
            <p className="card-subtitle">{subtitle}</p>
          </div>
        </div>
        {badge && <span className="chip">{badge}</span>}
      </div>
      <div className="card-body">
        {children}
        {note && (
          <div className="helper-text">
            <Info size={12} aria-hidden="true" />
            <span>{note}</span>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Analysis() {
  const { preferences, registerAnalysisRun, showToast } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const requestedRegion = getRegionById(searchParams.get('regionId'));
  const requestedState = searchParams.get('state');
  const initialRegion =
    requestedRegion ||
    (requestedState ? getFeaturedRegion(requestedState) : null) ||
    getRegionById(preferences.defaultRegionId) ||
    getRegionById('region-mulshi');

  const initialWindow = COMPOSITING_WINDOWS.includes(searchParams.get('window'))
    ? searchParams.get('window')
    : '3 months';

  const [stateValue, setStateValue] = useState(initialRegion.state);
  const [districtValue, setDistrictValue] = useState(initialRegion.district);
  const [regionId, setRegionId] = useState(initialRegion.id);
  const [startDate, setStartDate] = useState(searchParams.get('start') || '2024-06-01');
  const [endDate, setEndDate] = useState(searchParams.get('end') || '2024-11-30');
  const [compositingWindow, setCompositingWindow] = useState(initialWindow);
  const [errors, setErrors] = useState({});

  const [cloudProbability, setCloudProbability] = useState(DEFAULT_SETTINGS.cloudProbability);
  const [cloudShadows, setCloudShadows] = useState(DEFAULT_SETTINGS.cloudShadows);
  const [cirrus, setCirrus] = useState(DEFAULT_SETTINGS.cirrus);
  const [compositingMethod, setCompositingMethod] = useState(DEFAULT_SETTINGS.compositingMethod);
  const [baselinePeriod, setBaselinePeriod] = useState(DEFAULT_SETTINGS.baselinePeriod);
  const [seasonalWindow, setSeasonalWindow] = useState(DEFAULT_SETTINGS.seasonalWindow);
  const [algorithm, setAlgorithm] = useState(DEFAULT_SETTINGS.algorithm);
  const [confidenceThreshold, setConfidenceThreshold] = useState(
    DEFAULT_SETTINGS.confidenceThreshold,
  );

  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [lastRun, setLastRun] = useState(null);
  const timersRef = useRef([]);

  const selectedRegion = getRegionById(regionId);
  const isLocked = running;

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  useEffect(() => {
    if (running) return;
    setCompleted(false);
    setLastRun(null);
    setCurrentStep(-1);
  }, [
    stateValue,
    districtValue,
    regionId,
    startDate,
    endDate,
    compositingWindow,
    compositingMethod,
    baselinePeriod,
    seasonalWindow,
    algorithm,
    confidenceThreshold,
    cloudProbability,
    cloudShadows,
    cirrus,
  ]);

  const rangeDays = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return null;
    const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
    return Number.isFinite(days) ? days : null;
  }, [startDate, endDate]);

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

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const finishRun = (region) => {
    const output = createDemoRunOutput({
      region,
      startDate,
      endDate,
      compositingWindow,
      algorithm,
      confidenceThreshold,
    });
    registerAnalysisRun(output.run, output.results);
    setCurrentStep(WORKFLOW_STEPS.length);
    setRunning(false);
    setCompleted(true);
    setLastRun(output);
    showToast({
      type: 'success',
      title: 'Demo analysis complete',
      message: `${output.run.findings} illustrative findings were generated locally. Open Results to review the simulated run.`,
    });
  };

  const handleRunAnalysis = () => {
    if (running) return;
    if (!validate() || !selectedRegion) {
      showToast({
        type: 'error',
        title: 'Analysis cannot start',
        message: 'Select a complete study area and a valid date range first.',
      });
      return;
    }

    clearTimers();
    setRunning(true);
    setCompleted(false);
    setLastRun(null);
    setCurrentStep(0);
    showToast({
      type: 'info',
      title: 'Demo workflow started',
      message:
        'The frontend is simulating the seven processing stages locally. No satellite imagery is downloaded.',
    });

    let elapsed = 0;
    WORKFLOW_STEPS.forEach((step, index) => {
      elapsed += step.duration;
      const timer = window.setTimeout(() => {
        if (index < WORKFLOW_STEPS.length - 1) {
          setCurrentStep(index + 1);
        } else {
          finishRun(selectedRegion);
        }
      }, elapsed);
      timersRef.current.push(timer);
    });
  };

  const handleReset = () => {
    clearTimers();
    setRunning(false);
    setCompleted(false);
    setLastRun(null);
    setCurrentStep(-1);
    const fallback =
      getRegionById(preferences.defaultRegionId) || getRegionById('region-mulshi');
    setStateValue(fallback.state);
    setDistrictValue(fallback.district);
    setRegionId(fallback.id);
    setStartDate('2024-06-01');
    setEndDate('2024-11-30');
    setCompositingWindow('3 months');
    setErrors({});
    showToast({
      type: 'info',
      title: 'Filters reset',
      message: 'Study area, dates and composite window were restored to the demo defaults.',
    });
  };

  const goToResults = () => {
    if (!lastRun) return;
    const params = new URLSearchParams({
      run: lastRun.run.id,
      region: lastRun.run.regionId,
    });
    navigate(`/results?${params.toString()}`);
  };

  const completedSteps = completed ? WORKFLOW_STEPS.length : Math.max(currentStep, 0);
  const progressPercent = completed
    ? 100
    : running
      ? Math.round((completedSteps / WORKFLOW_STEPS.length) * 100)
      : 0;
  const activeStep = running ? WORKFLOW_STEPS[currentStep] : null;
  const statusTitle = running
    ? `Processing demo stage ${currentStep + 1} of ${WORKFLOW_STEPS.length}`
    : completed
      ? 'Demo analysis complete'
      : 'Ready to run analysis';
  const statusMessage = running
    ? `${activeStep?.label} — ${activeStep?.description}. Simulated locally; no satellite data is requested.`
    : completed
      ? `${lastRun?.run.findings || 0} illustrative findings are saved in this browser.`
      : 'Review the parameters below, then start the simulated seven-stage workflow.';

  return (
    <>
      <PageHeader
        title="Analysis"
        subtitle="Configure analysis parameters and run forest loss detection using Sentinel-2 imagery."
        meta={
          <>
            <span className="badge badge-info">
              <span className="dot" aria-hidden="true" />
              Simulated workflow
            </span>
            <span className="chip neutral">
              <Satellite size={11} aria-hidden="true" />
              Sentinel-2 Level-2A optical
            </span>
          </>
        }
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/results')}>
            <ArrowRight size={15} aria-hidden="true" />
            View Results
          </button>
        }
      />

      <section className="card filter-bar" aria-label="Analysis filters">
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
          disabled={isLocked}
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
          disabled={isLocked}
        />
        <FormField label="Compositing Window" htmlFor="analysis-filter-window">
          <select
            id="analysis-filter-window"
            className="select"
            value={compositingWindow}
            onChange={(event) => setCompositingWindow(event.target.value)}
            disabled={isLocked}
          >
            {COMPOSITING_WINDOWS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FormField>
        <div className="filter-button">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReset}
            disabled={isLocked}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset filters
          </button>
        </div>
      </section>

      <div className="analysis-settings">
        <SettingsCard
          icon={Cloud}
          title="Cloud Masking"
          subtitle="Remove cloud-contaminated pixels"
          badge="Sentinel-2 QA"
          note="Cloud masking uses Sentinel-2 quality bands to exclude clouds and shadows before comparison. In this demo the toggles only affect the saved run metadata."
        >
          <div>
            <div className="toggle-row">
              <div className="toggle-copy">
                <span
                  className="toggle-label"
                  title="Use the Sentinel-2 cloud-probability layer to flag cloud-contaminated pixels."
                >
                  Use cloud probability layer
                </span>
                <p className="toggle-help">
                  Flags pixels using the scene classification and cloud-probability layers.
                </p>
              </div>
              <ToggleSwitch
                checked={cloudProbability}
                onChange={setCloudProbability}
                disabled={isLocked}
                label="Use cloud probability layer"
              />
            </div>
            <div className="toggle-row">
              <div className="toggle-copy">
                <span
                  className="toggle-label"
                  title="Mask the dark pixels adjacent to clouds that can distort vegetation indices."
                >
                  Detect cloud shadows
                </span>
                <p className="toggle-help">
                  Removes shadow pixels that can mimic vegetation change.
                </p>
              </div>
              <ToggleSwitch
                checked={cloudShadows}
                onChange={setCloudShadows}
                disabled={isLocked}
                label="Detect cloud shadows"
              />
            </div>
            <div className="toggle-row">
              <div className="toggle-copy">
                <span
                  className="toggle-label"
                  title="Mask thin cirrus bands that reduce surface-reflectance quality."
                >
                  Mask cirrus
                </span>
                <p className="toggle-help">
                  Excludes thin high-altitude cloud present in some scenes.
                </p>
              </div>
              <ToggleSwitch
                checked={cirrus}
                onChange={setCirrus}
                disabled={isLocked}
                label="Mask cirrus"
              />
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={Layers}
          title="Temporal Compositing"
          subtitle="Combine valid observations over time"
          badge="Optical"
          note="Temporal compositing combines valid observations from a time window to reduce cloud-related gaps. The composite window is shared with the filter toolbar."
        >
          <FormField label="Compositing Method" htmlFor="analysis-composite-method">
            <select
              id="analysis-composite-method"
              className="select"
              value={compositingMethod}
              onChange={(event) => setCompositingMethod(event.target.value)}
              disabled={isLocked}
            >
              {COMPOSITING_METHODS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Composite Window" htmlFor="analysis-composite-window">
            <select
              id="analysis-composite-window"
              className="select"
              value={compositingWindow}
              onChange={(event) => setCompositingWindow(event.target.value)}
              disabled={isLocked}
            >
              {COMPOSITING_WINDOWS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FormField>
        </SettingsCard>

        <SettingsCard
          icon={CalendarClock}
          title="Seasonal Baseline"
          subtitle="Compare against a similar season"
          badge="Season-aware"
          note="Season-aware comparison helps distinguish normal vegetation cycles from possible forest disturbance."
        >
          <FormField label="Baseline Period" htmlFor="analysis-baseline-period">
            <select
              id="analysis-baseline-period"
              className="select"
              value={baselinePeriod}
              onChange={(event) => setBaselinePeriod(event.target.value)}
              disabled={isLocked}
            >
              {BASELINE_PERIODS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Seasonal Window" htmlFor="analysis-seasonal-window">
            <select
              id="analysis-seasonal-window"
              className="select"
              value={seasonalWindow}
              onChange={(event) => setSeasonalWindow(event.target.value)}
              disabled={isLocked}
            >
              {SEASONAL_WINDOWS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FormField>
        </SettingsCard>

        <SettingsCard
          icon={SlidersHorizontal}
          title="Model & Detection"
          subtitle="Choose an intended detection approach"
          badge="Demo only"
          note="Algorithm choices describe planned processing options. No model runs in the frontend until a processing API is connected."
        >
          <FormField label="Algorithm" htmlFor="analysis-algorithm">
            <select
              id="analysis-algorithm"
              className="select"
              value={algorithm}
              onChange={(event) => setAlgorithm(event.target.value)}
              disabled={isLocked}
            >
              {ALGORITHMS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FormField>
          <div>
            <label className="form-label" htmlFor="analysis-confidence">
              Confidence Threshold
            </label>
            <div className="range-row">
              <input
                id="analysis-confidence"
                type="range"
                className="range-input"
                min="0"
                max="1"
                step="0.01"
                value={confidenceThreshold}
                onChange={(event) => setConfidenceThreshold(Number(event.target.value))}
                aria-valuetext={`${Math.round(confidenceThreshold * 100)} percent confidence threshold`}
                disabled={isLocked}
              />
              <span className="range-value">{confidenceThreshold.toFixed(2)}</span>
            </div>
            <div className="range-scale">
              <span>0.0 · permissive</span>
              <span>1.0 · strict</span>
            </div>
          </div>
        </SettingsCard>
      </div>

      <div className="action-strip">
        <div className="action-strip-copy">
          <span className="action-strip-icon" aria-hidden="true">
            <Cpu size={18} />
          </span>
          <div>
            <div className="action-strip-title">Run the seven-stage demonstration</div>
            <div className="action-strip-text">
              The frontend simulates processing only. It does not download imagery or execute the
              selected model. Results are labelled as generated demo data.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="chip">Simulated</span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRunAnalysis}
            disabled={isLocked || !selectedRegion}
          >
            {isLocked ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Running demo…
              </>
            ) : (
              <>
                <Play size={14} aria-hidden="true" />
                Run Analysis
              </>
            )}
          </button>
        </div>
      </div>

      <section className="card workflow-card" aria-labelledby="analysis-workflow-title">
        <div className="card-head workflow-card-head">
          <div>
            <h2 className="card-title" id="analysis-workflow-title">
              <Activity size={16} aria-hidden="true" />
              Analysis Workflow
            </h2>
            <p className="card-subtitle">
              Intended processing sequence for optical Sentinel-2 Level-2A imagery
            </p>
          </div>
          <div className="card-actions">
            <span className="chip neutral">
              {completed ? 'Demo complete' : running ? 'Simulation running' : '7 stages'}
            </span>
          </div>
        </div>
        <div className="workflow-steps" aria-label="Seven-stage analysis workflow">
          {WORKFLOW_STEPS.map((step, index) => {
            const stepCompleted = index < currentStep;
            const stepActive = running && index === currentStep;
            return (
              <Fragment key={step.id}>
                {index > 0 && (
                  <div className="workflow-connector" aria-hidden="true">
                    <ArrowRight size={12} />
                  </div>
                )}
                <div
                  className={`workflow-step ${stepCompleted ? 'completed' : ''} ${
                    stepActive ? 'active' : ''
                  }`.trim()}
                  aria-current={stepActive ? 'step' : undefined}
                >
                  <span className="workflow-num">
                    {stepCompleted ? (
                      <Check size={15} aria-hidden="true" />
                    ) : stepActive ? (
                      <span className="spinner" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="workflow-step-label">{step.label}</span>
                  <span className="workflow-step-desc">{step.description}</span>
                </div>
              </Fragment>
            );
          })}
        </div>
        <div className="workflow-progress">
          <div className="workflow-progress-meta">
            <span aria-live="polite">
              {running ? (
                <>
                  Stage <strong>{currentStep + 1}</strong> of {WORKFLOW_STEPS.length} ·{' '}
                  {activeStep?.label}
                </>
              ) : completed ? (
                <>Demo workflow complete — illustrative results saved locally.</>
              ) : (
                <>Ready — press Run Analysis to start the demo sequence.</>
              )}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label="Demo workflow progress"
          >
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </section>

      <div className="analysis-bottom">
        <section className="card" aria-labelledby="analysis-status-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="analysis-status-title">
                <Clock3 size={16} aria-hidden="true" />
                Analysis Status
              </h2>
              <p className="card-subtitle">Current configuration and demo state</p>
            </div>
            <StatusBadge value={running ? 'Processing' : completed ? 'Completed' : 'Pending'} />
          </div>
          <div className="card-body">
            <div
              aria-live="polite"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 9,
                border: `1px solid ${
                  running ? 'var(--amber-soft)' : 'var(--green-100)'
                }`,
                background: running ? 'var(--amber-soft)' : 'var(--mint)',
                marginBottom: 14,
              }}
            >
              <span
                className="settings-card-icon"
                style={{ width: 30, height: 30, background: '#fff' }}
                aria-hidden="true"
              >
                <Activity size={14} />
              </span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--heading)' }}>
                  {statusTitle}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.45 }}>
                  {statusMessage}
                </div>
              </div>
            </div>

            <div className="kv-list">
              <div className="kv-row">
                <span>Study area</span>
                <span className="v strong">
                  {selectedRegion ? selectedRegion.name : 'No area selected'}
                </span>
              </div>
              <div className="kv-row">
                <span>Date range</span>
                <span className="v">
                  {formatDate(startDate)} – {formatDate(endDate)}
                  {rangeDays ? ` · ${rangeDays} days` : ''}
                </span>
              </div>
              <div className="kv-row">
                <span>Compositing</span>
                <span className="v">
                  {compositingMethod} · {compositingWindow}
                </span>
              </div>
              <div className="kv-row">
                <span>Seasonal baseline</span>
                <span className="v">
                  {baselinePeriod} · {seasonalWindow}
                </span>
              </div>
              <div className="kv-row">
                <span>Algorithm</span>
                <span className="v">
                  {algorithm} · threshold {confidenceThreshold.toFixed(2)}
                </span>
              </div>
              <div className="kv-row">
                <span>Cloud masking</span>
                <span className="v">
                  {[cloudProbability && 'probability', cloudShadows && 'shadows', cirrus && 'cirrus']
                    .filter(Boolean)
                    .join(', ') || 'Disabled'}
                </span>
              </div>
              <div className="kv-row">
                <span>Estimated demo time</span>
                <span className="v">≈ 7 seconds (simulation only)</span>
              </div>
              <div className="kv-row">
                <span>Processing backend</span>
                <span className="v">Not connected</span>
              </div>
            </div>

            {completed && lastRun && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  background: 'var(--mint)',
                  border: '1px solid var(--green-100)',
                  borderRadius: 9,
                }}
              >
                <div className="row-between" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 12.5, color: 'var(--heading)' }}>
                    Demo run {lastRun.run.id}
                  </strong>
                  <span className="badge badge-success">
                    <span className="dot" aria-hidden="true" />
                    Completed
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
                  {lastRun.run.findings} illustrative findings for {lastRun.run.regionName} were
                  generated and saved locally.
                </p>
                <div className="btn-group" style={{ marginTop: 10 }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={goToResults}>
                    View Results
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleRunAnalysis}
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                    Run again
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <DemoNotice>
                The estimated time is illustrative. No imagery is downloaded and no model is executed;
                a Flask or FastAPI processing service must provide real results.
              </DemoNotice>
            </div>
          </div>
        </section>

        <section className="card analysis-summary-card" aria-labelledby="analysis-summary-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="analysis-summary-title">
                <MapPin size={16} aria-hidden="true" />
                Analysis Summary
              </h2>
              <p className="card-subtitle">Classification totals from the latest demo run</p>
            </div>
            <span className="chip">Demo</span>
          </div>
          <div className="card-body">
            {lastRun ? (
              <>
                <div className="summary-total">
                  <div>
                    <div className="summary-total-label">Total Study Area</div>
                    <div className="summary-total-value">
                      {lastRun.summary.total.toLocaleString('en-IN')}
                      <span>km²</span>
                    </div>
                  </div>
                  <div className="summary-total-note">Illustrative demo output</div>
                </div>

                <div className="summary-list">
                  {SUMMARY_ROWS.map((row) => {
                    const value = lastRun.summary[row.key];
                    const pct = percentageOf(value, lastRun.summary.total);
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
                    <span>Generated</span>
                    <strong>{formatDate(lastRun.summary.observationDate)}</strong>
                  </div>
                  <div className="summary-meta-row">
                    <span>Demo findings</span>
                    <strong>{lastRun.run.findings}</strong>
                  </div>
                  <div className="summary-meta-row">
                    <span>Run ID</span>
                    <strong>{lastRun.run.id}</strong>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <DemoNotice>
                    Simulated totals generated by the frontend demo workflow. These are not measured
                    satellite-analysis results and must not be used for management decisions.
                  </DemoNotice>
                </div>
              </>
            ) : (
              <div className="analysis-awaiting">
                <EmptyState
                  icon={running ? Activity : Clock3}
                  title={running ? 'Demo analysis in progress' : 'Awaiting analysis'}
                  message={
                    running
                      ? 'Classification totals will appear when the simulated workflow finishes.'
                      : 'Run the demo workflow to generate illustrative classification totals for the selected study area.'
                  }
                />
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="card method-card" aria-labelledby="analysis-methodology-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="analysis-methodology-title">
              <ShieldCheck size={16} aria-hidden="true" />
              Methodology &amp; Data Source
            </h2>
            <p className="card-subtitle">Optical satellite approach intended for the production system</p>
          </div>
          <span className="chip neutral">Optical only</span>
        </div>
        <div className="card-body">
          <div className="method-note">
            <Satellite size={16} aria-hidden="true" />
            <span>
              This workflow uses optical Sentinel-2 imagery. Cloud masking, temporal compositing and
              seasonal comparison are intended to improve the reliability of forest-change detection.
              Sentinel-1 radar data is not used.
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <DemoNotice>
              Frontend demonstration only. The animation, classification totals and findings are
              generated sample data. Real Sentinel-2 Level-2A retrieval, preprocessing and model
              inference require the planned backend service.
            </DemoNotice>
          </div>
        </div>
      </section>
    </>
  );
}
