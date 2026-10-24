import { downloadText, safeFilename } from './download';

function escapeCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(columns, rows) {
  const header = columns.map((column) => escapeCell(column.label)).join(',');
  const body = rows
    .map((row) => columns.map((column) => escapeCell(column.value(row))).join(','))
    .join('\r\n');
  return `\uFEFF${header}\r\n${body}`;
}

export function downloadCsv(filename, columns, rows) {
  const csv = toCsv(columns, rows);
  downloadText(`${safeFilename(filename)}.csv`, csv, 'text/csv;charset=utf-8');
}

export const RESULT_COLUMNS = [
  { label: 'Location', value: (row) => row.location },
  { label: 'District', value: (row) => row.district },
  { label: 'State', value: (row) => row.state },
  { label: 'Classification', value: (row) => row.classification },
  { label: 'Area km2', value: (row) => row.areaKm2 },
  { label: 'Confidence', value: (row) => Math.round(row.confidence * 100) },
  { label: 'Observation Date', value: (row) => row.observationDate },
  { label: 'Status', value: (row) => row.status },
  { label: 'Data Source', value: () => 'Illustrative demo data' },
];

export const RUN_COLUMNS = [
  { label: 'Run ID', value: (row) => row.id },
  { label: 'Region', value: (row) => row.regionName },
  { label: 'State', value: (row) => row.state },
  { label: 'Start Date', value: (row) => row.startDate },
  { label: 'End Date', value: (row) => row.endDate },
  { label: 'Compositing Window', value: (row) => row.compositingWindow },
  { label: 'Findings', value: (row) => row.findings },
  { label: 'Status', value: (row) => row.status },
  { label: 'Data Source', value: () => 'Illustrative demo data' },
];
