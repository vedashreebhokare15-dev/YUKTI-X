import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BrainCircuit, Target } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import ChartCard from '../components/common/ChartCard';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import MetricCard from '../components/common/MetricCard';
import { fetchModelReport } from '../services/backendService';
import { formatDateTime, formatNumber } from '../utils/formatters';

const LOSS = '#d7263d';
const STABLE = '#2f9e6b';
const NOT_MEASURED = 'Not measured';

function percent(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return NOT_MEASURED;
  return `${(Number(value) * 100).toFixed(digits)} %`;
}

function rateHelp(rate) {
  if (!rate || rate.point === null || rate.interval === null) return NOT_MEASURED;
  return `${rate.numerator} of ${rate.denominator} scored cells, 95 % interval `
    + `${percent(rate.interval[0])} to ${percent(rate.interval[1])}`;
}

function confusionCells(metrics) {
  return [
    { key: 'true_positive', label: 'Loss called loss', tone: 'good', count: metrics.true_positive },
    { key: 'false_positive', label: 'Stable called loss', tone: 'bad', count: metrics.false_positive },
    { key: 'false_negative', label: 'Loss called stable', tone: 'bad', count: metrics.false_negative },
    { key: 'true_negative', label: 'Stable called stable', tone: 'good', count: metrics.true_negative },
  ];
}

export default function ModelReport() {
  const [report, setReport] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetchModelReport()
      .then((payload) => {
        if (!alive) return;
        setReport(payload);
        setState('ready');
      })
      .catch((requestError) => {
        if (!alive) return;
        setError(requestError.message);
        setState(requestError.status === 404 ? 'absent' : 'failed');
      });
    return () => { alive = false; };
  }, []);

  if (state === 'loading') return <LoadingState label="Reading the model report" />;

  if (state !== 'ready') {
    return (
      <>
        <PageHeader
          title="Model"
          subtitle="The trained forest-loss model and the held-out region it was scored on."
        />
        <section className="card">
          <div className="card-body">
            <EmptyState
              icon={BrainCircuit}
              title={state === 'absent' ? 'No trained model report yet' : 'The model report could not be read'}
              message={error}
            />
          </div>
        </section>
      </>
    );
  }

  const { metrics, model, train, evaluation } = report;
  const importances = report.feature_importances
    .slice()
    .sort((a, b) => b.importance - a.importance);

  return (
    <>
      <PageHeader
        title="Model"
        subtitle="A random forest over seasonal-index features, labelled by the 30 m global loss product and scored on a region it never saw."
        meta={(
          <span className="chip">
            {formatDateTime(report.generated_at)} · {model.rows} training rows
          </span>
        )}
      />

      <div className="metrics-grid results-section">
        <MetricCard
          icon={Target}
          label="Precision"
          value={percent(metrics.precision.point)}
          help={rateHelp(metrics.precision)}
        />
        <MetricCard
          icon={Target}
          label="Recall"
          value={percent(metrics.recall.point)}
          help={rateHelp(metrics.recall)}
        />
        <MetricCard
          icon={Target}
          label="False alarm on stable cells"
          value={percent(metrics.false_alarm_rate.point)}
          help={rateHelp(metrics.false_alarm_rate)}
        />
        <MetricCard
          icon={BrainCircuit}
          label="F1"
          value={metrics.f1 === null ? NOT_MEASURED : metrics.f1.toFixed(3)}
          help={`${metrics.scored} of ${metrics.total} held-out cells scored`}
        />
      </div>

      <div className="model-grid">
        <ChartCard
          title="Held-out region score"
          subtitle={`Trained on ${train.region_name}, scored on ${evaluation.region_name}.`}
        >
          <div className="card-body">
            <dl className="model-confusion">
              {confusionCells(metrics).map((entry) => (
                <div key={entry.key} className={`model-confusion-cell ${entry.tone}`}>
                  <dt>{entry.label}</dt>
                  <dd>{formatNumber(entry.count)}</dd>
                </div>
              ))}
            </dl>
            <dl className="model-values">
              <div><dt>Training rows</dt><dd>{formatNumber(train.rows)}</dd></div>
              <div><dt>Loss rows</dt><dd>{formatNumber(train.counts.loss)}</dd></div>
              <div><dt>Scored cells</dt><dd>{formatNumber(metrics.scored)}</dd></div>
              <div><dt>Abstained</dt><dd>{formatNumber(metrics.abstained)}</dd></div>
              <div>
                <dt>Loss share of the sample</dt>
                <dd>{percent(metrics.loss_prevalence_in_sample)}</dd>
              </div>
              <div>
                <dt>Label source</dt>
                <dd className="model-muted">{train.reference_asset}</dd>
              </div>
              <div>
                <dt>Windows compared</dt>
                <dd className="model-muted">
                  {train.before_window[0]} to {train.after_window[1]}
                </dd>
              </div>
            </dl>
          </div>
        </ChartCard>

        <ChartCard
          title="What the trees actually split on"
          subtitle="Feature importance from the fitted forest, as a share of the total."
        >
          <div className="card-body model-chart">
            <ResponsiveContainer width="100%" height={Math.max(importances.length * 30, 120)}>
              <BarChart data={importances} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                       stroke="var(--muted)" fontSize={11} />
                <YAxis type="category" dataKey="name" width={110}
                       stroke="var(--muted)" fontSize={11} />
                <Tooltip formatter={(value) => percent(value, 2)} />
                <Bar dataKey="importance" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {importances.map((entry) => (
                    <Cell key={entry.name} fill="var(--green-600)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard
        title="Every held-out cell, labelled and predicted"
        subtitle="A prediction is a class from tree votes, not a probability."
      >
        <div className="card-body table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cell (lon, lat)</th>
                <th>Reference label</th>
                <th>Prediction</th>
                <th>Loss share of reference pixels</th>
                <th>Agrees</th>
              </tr>
            </thead>
            <tbody>
              {report.cells.map((cell) => (
                <tr key={cell.cell_id || `${cell.position}`}>
                  <td>{cell.position ? `${cell.position[0].toFixed(5)}, ${cell.position[1].toFixed(5)}` : '—'}</td>
                  <td>
                    <span className="model-swatch" style={{ background: cell.label === 'loss' ? LOSS : STABLE }} />
                    {cell.label}
                  </td>
                  <td>
                    <span className="model-swatch" style={{ background: cell.prediction === 'loss' ? LOSS : STABLE }} />
                    {cell.prediction}
                  </td>
                  <td>{cell.loss_share === null || cell.loss_share === undefined ? NOT_MEASURED : percent(cell.loss_share)}</td>
                  <td>{cell.correct ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">What this does not say</h2>
          </div>
        </div>
        <div className="card-body">
          <ul className="model-gaps">
            {report.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
            <li>
              Cell size and label thresholds: {train.rows} training and {evaluation.rows} scored
              cells came from boxes the reference layer could label; every other cell abstained
              and is not counted as stable.
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
