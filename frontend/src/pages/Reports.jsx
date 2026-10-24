import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  MapPin,
  MoreVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import MetricCard from '../components/common/MetricCard';
import FormField from '../components/common/FormField';
import DemoNotice from '../components/common/DemoNotice';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import EmptyState from '../components/common/EmptyState';
import DataTable from '../components/common/DataTable';
import Pagination from '../components/common/Pagination';
import ReportsAnalytics from '../components/charts/ReportsAnalytics';
import { useApp } from '../context/AppContext';
import { REGIONS } from '../data/studyAreas';
import {
  REPORT_COPY,
  REPORT_SECTIONS,
  REPORT_TYPE_COLORS,
  REPORT_TYPES,
} from '../data/reports';
import { downloadReportPdf } from '../utils/reportPdf';
import { reportFacts } from '../services/resultsService';
import { formatArea, formatDate } from '../utils/formatters';

const PAGE_SIZE = 5;

const REPORT_FILTER_RANGES = [
  { id: 'all', label: 'All dates', from: null, to: null },
  { id: 'nov-2024', label: 'November 2024', from: '2024-11-01', to: '2024-11-30' },
  { id: 'q4-2024', label: 'Oct – Dec 2024', from: '2024-10-01', to: '2024-12-31' },
  { id: 'year-2024', label: 'Full year 2024', from: '2024-01-01', to: '2024-12-31' },
];

function TypeChip({ type }) {
  const color = REPORT_TYPE_COLORS[type] || '#8A94A6';
  return (
    <span
      className="chip"
      style={{
        color,
        background: `${color}14`,
        borderColor: `${color}44`,
      }}
    >
      {type}
    </span>
  );
}

function defaultReportForm() {
  return {
    regionId: 'region-melghat',
    type: 'Summary',
    name: 'Forest Loss Summary Report',
    startDate: '2024-06-01',
    endDate: '2024-11-30',
  };
}

export default function Reports() {
  const {
    reports,
    addReport,
    removeReport,
    incrementReportDownload,
    showToast,
  } = useApp();

  const [regionFilter, setRegionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [reportForm, setReportForm] = useState(defaultReportForm);
  const [formErrors, setFormErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionReport, setActionReport] = useState(null);
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [regionFilter, typeFilter, dateFilter]);

  const regionOptions = useMemo(() => {
    const map = new Map();
    reports.forEach((report) => {
      if (report.regionId && !map.has(report.regionId)) {
        map.set(report.regionId, report.regionName);
      }
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [reports]);

  const filteredReports = useMemo(() => {
    const range = REPORT_FILTER_RANGES.find((item) => item.id === dateFilter) || REPORT_FILTER_RANGES[0];
    return reports
      .filter((report) => {
        if (regionFilter !== 'all' && report.regionId !== regionFilter) return false;
        if (typeFilter !== 'all' && report.type !== typeFilter) return false;
        const generated = String(report.generatedAt || '').slice(0, 10);
        if (range.from && generated < range.from) return false;
        if (range.to && generated > range.to) return false;
        return true;
      })
      .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
  }, [reports, regionFilter, typeFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedReports = filteredReports.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedReport =
    filteredReports.find((report) => report.id === selectedId) || filteredReports[0] || null;
  const previewFacts = selectedReport ? reportFacts(selectedReport) : null;

  const totalDownloads = filteredReports.reduce(
    (total, report) => total + (report.downloads || 0),
    0,
  );
  const areasMonitored = new Set(filteredReports.map((report) => report.regionId)).size;
  const latestReport = filteredReports[0] || null;

  const previewReport = (report) => {
    setSelectedId(report.id);
    window.setTimeout(() => {
      document.getElementById('report-preview-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 60);
  };

  const openGenerate = () => {
    setReportForm(defaultReportForm());
    setFormErrors({});
    setGenerateOpen(true);
  };

  const validateForm = () => {
    const next = {};
    if (!reportForm.regionId) next.region = 'Select a region.';
    if (!reportForm.type) next.type = 'Select a report type.';
    if (!reportForm.name.trim()) next.name = 'Enter a report name.';
    if (!reportForm.startDate) next.start = 'Select a start date.';
    if (!reportForm.endDate) next.end = 'Select an end date.';
    if (
      reportForm.startDate &&
      reportForm.endDate &&
      reportForm.startDate > reportForm.endDate
    ) {
      next.end = 'End date cannot be before the start date.';
    }
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const generateReport = () => {
    if (!validateForm()) return;
    const region = REGIONS.find((item) => item.id === reportForm.regionId);
    if (!region) return;

    const newReport = {
      id: `report-${Date.now().toString().slice(-7)}`,
      name: reportForm.name.trim(),
      type: reportForm.type,
      regionId: region.id,
      regionName: region.name,
      state: region.state,
      startDate: reportForm.startDate,
      endDate: reportForm.endDate,
      generatedAt: new Date().toISOString(),
      sizeMb: Number((1.1 + reportForm.type.length * 0.17).toFixed(1)),
      downloads: 0,
      isDemo: true,
      generated: true,
    };

    addReport(newReport);
    setSelectedId(newReport.id);
    setRegionFilter('all');
    setTypeFilter('all');
    setDateFilter('all');
    setPage(1);
    setGenerateOpen(false);
    showToast({
      type: 'success',
      title: 'Demo report generated',
      message: `${newReport.name} was added to the local report library. Download it to create the illustrative PDF.`,
    });
  };

  const handleDownload = (report) => {
    downloadReportPdf(report);
    incrementReportDownload(report.id);
    showToast({
      type: 'success',
      title: 'PDF downloaded',
      message:
        'The report was generated client-side from illustrative demo records. No satellite data is embedded.',
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    removeReport(deleteTarget.id);
    showToast({
      type: 'success',
      title: 'Demo report removed',
      message: `${deleteTarget.name} was removed from this browser's report library.`,
    });
    setDeleteTarget(null);
  };

  const columns = [
    {
      key: 'name',
      label: 'Report Name',
      render: (report) => (
        <div>
          <div className="cell-strong">{report.name}</div>
          <div className="cell-muted">{report.downloads || 0} downloads</div>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (report) => <TypeChip type={report.type} />,
    },
    {
      key: 'regionName',
      label: 'Region',
      render: (report) => (
        <div>
          <div className="cell-strong">{report.regionName}</div>
          <div className="cell-muted">{report.state}</div>
        </div>
      ),
    },
    {
      key: 'generatedAt',
      label: 'Date Generated',
      render: (report) => formatDate(report.generatedAt),
    },
    {
      key: 'sizeMb',
      label: 'Size',
      align: 'right',
      render: (report) => <span className="num-cell">{report.sizeMb.toFixed(1)} MB</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (report) => (
        <div className="btn-group" style={{ justifyContent: 'flex-end', gap: 4 }}>
          <button
            type="button"
            className="icon-btn plain"
            onClick={(event) => {
              event.stopPropagation();
              previewReport(report);
            }}
            aria-label={`Preview ${report.name}`}
            title="Preview report"
          >
            <Eye size={14} />
          </button>
          <button
            type="button"
            className="icon-btn plain"
            onClick={(event) => {
              event.stopPropagation();
              handleDownload(report);
            }}
            aria-label={`Download ${report.name}`}
            title="Download PDF"
          >
            <Download size={14} />
          </button>
          <button
            type="button"
            className="icon-btn plain"
            onClick={(event) => {
              event.stopPropagation();
              setActionReport(report);
            }}
            aria-label={`More actions for ${report.name}`}
            title="More actions"
          >
            <MoreVertical size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="View, download and manage detailed forest monitoring reports."
        meta={
          <>
            <span className="badge badge-info">
              <span className="dot" aria-hidden="true" />
              Demo report library
            </span>
            <span className="chip neutral">PDFs generated in-browser</span>
          </>
        }
      />

      <section className="card filter-bar" aria-label="Report filters">
        <FormField label="Region" htmlFor="reports-region">
          <select
            id="reports-region"
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
        </FormField>
        <FormField label="Date Range" htmlFor="reports-date-range">
          <select
            id="reports-date-range"
            className="select"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          >
            {REPORT_FILTER_RANGES.map((range) => (
              <option key={range.id} value={range.id}>
                {range.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Report Type" htmlFor="reports-type">
          <select
            id="reports-type"
            className="select"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">All Reports</option>
            {REPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </FormField>
        <div className="filter-button">
          <button type="button" className="btn btn-primary" onClick={openGenerate}>
            <Plus size={14} aria-hidden="true" />
            Generate New Report
          </button>
        </div>
      </section>

      <div className="metrics-grid results-section">
        <MetricCard
          icon={FileText}
          label="Total Reports"
          value={filteredReports.length}
          help="Records matching the current filters"
          tone="teal"
        />
        <MetricCard
          icon={CalendarDays}
          label="Latest Report"
          value={latestReport ? formatDate(latestReport.generatedAt) : '—'}
          help="Newest generated demo report"
          tone="amber"
        />
        <MetricCard
          icon={Download}
          label="Total Downloads"
          value={totalDownloads}
          help="PDF downloads recorded in the filtered view"
          tone="blue"
        />
        <MetricCard
          icon={MapPin}
          label="Areas Monitored"
          value={areasMonitored}
          help="Distinct demo regions in the filtered view"
          tone="red"
        />
      </div>

      <div className="reports-layout">
        <section className="card" aria-labelledby="reports-table-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="reports-table-title">
                <FileText size={16} aria-hidden="true" />
                Available Reports
              </h2>
              <p className="card-subtitle">
                {filteredReports.length} report{filteredReports.length === 1 ? '' : 's'} in the
                current view
              </p>
            </div>
            <span className="chip">Illustrative</span>
          </div>
          <DataTable
            columns={columns}
            rows={pagedReports}
            selectedKey={selectedReport?.id || null}
            onRowClick={(report) => setSelectedId(report.id)}
            emptyTitle="No reports match these filters"
            emptyMessage="Try another region, report type or date range, or generate a new demo report."
            emptyIcon={FileText}
            caption="Available forest monitoring reports"
          />
          <Pagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={filteredReports.length}
            onChange={setPage}
            itemLabel="reports"
          />
          <div className="card-foot">
            <DemoNotice>
              All reports are demonstration records. Every download produces a clearly marked sample
              PDF; no measured satellite results are included.
            </DemoNotice>
          </div>
        </section>

        <aside
          className="card report-preview"
          id="report-preview-panel"
          aria-labelledby="report-preview-title"
        >
          {selectedReport ? (
            <>
              <div className="report-cover">
                <img
                  src="/assets/report-cover.png"
                  alt="Illustrative forest landscape used as the demonstration report cover"
                  loading="lazy"
                />
                <div className="report-cover-content">
                  <div className="report-cover-brand">
                    <img src="/assets/logo.svg" alt="" aria-hidden="true" />
                    VanaDrishti AI
                  </div>
                  <div style={{ fontSize: 10, color: '#e7f3ed', marginTop: 4 }}>
                    Illustrative report cover
                  </div>
                </div>
              </div>
              <div className="report-preview-body">
                <div className="report-preview-type">
                  <TypeChip type={selectedReport.type} />
                  <span className="chip neutral">Demo</span>
                </div>
                <h3 className="report-preview-title" id="report-preview-title">
                  {selectedReport.name}
                </h3>
                <div className="report-preview-meta">
                  <span>{selectedReport.regionName}</span>
                  <span>{selectedReport.state}</span>
                  <span>{formatDate(selectedReport.generatedAt)}</span>
                </div>

                <div className="report-metrics-mini">
                  <div className="report-metric-mini">
                    <div className="k">Records in report</div>
                    <div className="v">{previewFacts?.totalRecords ?? 0}</div>
                  </div>
                  <div className="report-metric-mini">
                    <div className="k">Reported loss area</div>
                    <div className="v">{formatArea(previewFacts?.lossAreaKm2)}</div>
                  </div>
                  <div className="report-metric-mini">
                    <div className="k">Awaiting review</div>
                    <div className="v">{previewFacts?.reviewCount ?? 0}</div>
                  </div>
                </div>

                <div className="report-checklist">
                  {REPORT_SECTIONS.map((section) => (
                    <div className="report-check" key={section}>
                      <CheckCircle2 size={13} aria-hidden="true" />
                      {section}
                    </div>
                  ))}
                </div>

                <div className="report-preview-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setFullPreviewOpen(true)}
                  >
                    <Eye size={13} aria-hidden="true" />
                    View Full Report
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDownload(selectedReport)}
                  >
                    <Download size={13} aria-hidden="true" />
                    Download PDF
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <DemoNotice>
                    Preview content uses illustrative sample figures. The downloaded PDF is generated
                    from the same demo record.
                  </DemoNotice>
                </div>
              </div>
            </>
          ) : (
            <div className="card-body">
              <EmptyState
                icon={FileText}
                title="No report selected"
                message="Adjust the filters or generate a new demo report to preview it here."
              />
            </div>
          )}
        </aside>
      </div>

      <ReportsAnalytics reports={filteredReports} />

      <div style={{ marginTop: 16 }}>
        <DemoNotice>
          Reports and analytics are generated from illustrative sample records. Future backend
          integration should provide verified Sentinel-2 summaries, spatial layers and trend data
          before reports are used operationally.
        </DemoNotice>
      </div>

      <Modal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Generate New Report"
        subtitle="Create a demonstration report record stored in this browser"
        size="wide"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setGenerateOpen(false)}
            >
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={generateReport}>
              <FileText size={14} aria-hidden="true" />
              Generate report
            </button>
          </>
        }
      >
        <div className="form-grid">
          <FormField label="Region" htmlFor="report-form-region" required error={formErrors.region}>
            <select
              id="report-form-region"
              className="select"
              value={reportForm.regionId}
              onChange={(event) => {
                setReportForm((current) => ({ ...current, regionId: event.target.value }));
                setFormErrors((current) => ({ ...current, region: undefined }));
              }}
            >
              {REGIONS.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name} — {region.state}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Report Type" htmlFor="report-form-type" required error={formErrors.type}>
            <select
              id="report-form-type"
              className="select"
              value={reportForm.type}
              onChange={(event) => {
                setReportForm((current) => ({ ...current, type: event.target.value }));
                setFormErrors((current) => ({ ...current, type: undefined }));
              }}
            >
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Report Name"
            htmlFor="report-form-name"
            required
            error={formErrors.name}
            className="span-2"
          >
            <input
              id="report-form-name"
              type="text"
              className="input"
              value={reportForm.name}
              onChange={(event) => {
                setReportForm((current) => ({ ...current, name: event.target.value }));
                setFormErrors((current) => ({ ...current, name: undefined }));
              }}
              placeholder="e.g. Monsoon Forest Loss Summary"
            />
          </FormField>
          <FormField
            label="Start Date"
            htmlFor="report-form-start"
            required
            error={formErrors.start}
          >
            <input
              id="report-form-start"
              type="date"
              className="input"
              value={reportForm.startDate}
              max={reportForm.endDate || undefined}
              onChange={(event) => {
                setReportForm((current) => ({ ...current, startDate: event.target.value }));
                setFormErrors((current) => ({ ...current, start: undefined, end: undefined }));
              }}
            />
          </FormField>
          <FormField label="End Date" htmlFor="report-form-end" required error={formErrors.end}>
            <input
              id="report-form-end"
              type="date"
              className="input"
              value={reportForm.endDate}
              min={reportForm.startDate || undefined}
              onChange={(event) => {
                setReportForm((current) => ({ ...current, endDate: event.target.value }));
                setFormErrors((current) => ({ ...current, end: undefined, start: undefined }));
              }}
            />
          </FormField>
        </div>
        <div style={{ marginTop: 12 }}>
          <DemoNotice>
            Generating adds a local demonstration record only. No satellite processing or data
            download occurs; the PDF is created on your device when you choose Download.
          </DemoNotice>
        </div>
      </Modal>

      <Modal
        open={Boolean(actionReport)}
        onClose={() => setActionReport(null)}
        title={actionReport ? actionReport.name : 'Report actions'}
        subtitle={
          actionReport
            ? `${actionReport.regionName} · generated ${formatDate(actionReport.generatedAt)}`
            : undefined
        }
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setActionReport(null)}>
            Close
          </button>
        }
      >
        {actionReport && (
          <>
            <div className="report-preview-meta" style={{ marginTop: 0 }}>
              <TypeChip type={actionReport.type} />
              <span>{actionReport.sizeMb.toFixed(1)} MB</span>
              <span>{actionReport.downloads || 0} downloads</span>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setActionReport(null);
                  previewReport(actionReport);
                }}
              >
                <Eye size={14} aria-hidden="true" />
                Preview report
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setActionReport(null);
                  handleDownload(actionReport);
                }}
              >
                <Download size={14} aria-hidden="true" />
                Download PDF
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setDeleteTarget(actionReport);
                  setActionReport(null);
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete report
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <DemoNotice>
                Deleting affects only this browser&apos;s demo report library. It does not remove any
                backend data.
              </DemoNotice>
            </div>
          </>
        )}
      </Modal>

      <ConfirmationModal
        open={Boolean(deleteTarget)}
        title="Delete this demo report?"
        message={
          deleteTarget
            ? `${deleteTarget.name} will be removed from this browser's report library. The action cannot be undone.`
            : ''
        }
        confirmLabel="Delete report"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      <Modal
        open={fullPreviewOpen && Boolean(selectedReport)}
        onClose={() => setFullPreviewOpen(false)}
        title={selectedReport?.name || 'Report preview'}
        subtitle="Document-style preview built from an illustrative demonstration record"
        size="wide"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setFullPreviewOpen(false)}
            >
              Close
            </button>
            {selectedReport && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleDownload(selectedReport)}
              >
                <Download size={14} aria-hidden="true" />
                Download PDF
              </button>
            )}
          </>
        }
      >
        {selectedReport && (
          <div className="report-doc">
            <div className="report-doc-header">
              <div className="report-doc-brand">
                <img src="/assets/logo.svg" alt="" aria-hidden="true" />
                <div>
                  <strong>VanaDrishti AI</strong>
                  <span>Forest Loss Monitoring &amp; Early Warning</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--muted)' }}>
                <div>
                  <TypeChip type={selectedReport.type} /> Report
                </div>
                <div style={{ marginTop: 3 }}>
                  Generated {formatDate(selectedReport.generatedAt)}
                </div>
              </div>
            </div>

            <img
              src="/assets/report-cover.png"
              alt="Illustrative forest landscape used as a report cover"
              style={{
                width: '100%',
                height: 170,
                objectFit: 'cover',
                borderRadius: 10,
                marginBottom: 14,
              }}
            />

            <h2 style={{ fontSize: 18, color: 'var(--heading)', lineHeight: 1.35 }}>
              {selectedReport.name}
            </h2>
            <p style={{ marginTop: 5 }}>
              Region: <strong>{selectedReport.regionName}</strong> · State:{' '}
              {selectedReport.state} · Reporting period: {formatDate(selectedReport.startDate)} –{' '}
              {formatDate(selectedReport.endDate)}
            </p>

            <div className="report-metrics-mini">
              <div className="report-metric-mini">
                <div className="k">Records in report</div>
                <div className="v">{previewFacts?.totalRecords ?? 0}</div>
              </div>
              <div className="report-metric-mini">
                <div className="k">Reported loss area</div>
                <div className="v">{formatArea(previewFacts?.lossAreaKm2)}</div>
              </div>
              <div className="report-metric-mini">
                <div className="k">Awaiting review</div>
                <div className="v">{previewFacts?.reviewCount ?? 0}</div>
              </div>
            </div>

            {REPORT_SECTIONS.map((section) => (
              <div key={section}>
                <h3>{section}</h3>
                <p>{REPORT_COPY[section]}</p>
              </div>
            ))}

            <DemoNotice>
              This document is a demonstration preview. It uses illustrative sample records and does
              not contain verified Sentinel-2 observations or measured forest-loss results.
            </DemoNotice>
          </div>
        )}
      </Modal>
    </>
  );
}
