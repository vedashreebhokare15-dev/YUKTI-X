import { jsPDF } from 'jspdf';
import { REGIONS } from '../data/studyAreas';
import { REPORT_COPY, REPORT_SECTIONS } from '../data/reports';
import { reportFacts } from '../services/resultsService';
import { formatDate } from '../utils/formatters';
import { safeFilename } from '../utils/download';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_TOP = PAGE_H - 20;

const INK = { heading: [6, 78, 59], dark: [16, 45, 61], body: [71, 85, 105], muted: [100, 116, 139] };
const CLASS_COLOR = {
  'Likely Forest Loss': [215, 38, 61],
  'Possible Forest Loss': [245, 158, 11],
  'No Detected Loss': [38, 155, 91],
  'Insufficient Evidence': [138, 148, 166],
};

function clean(value) {
  return String(value ?? '')
    .replace(/²/g, '2')
    .replace(/[–—]/g, '-')
    .replace(/±/g, '+/-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function number(value, digits = 1) {
  const n = Number(value);
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// jsPDF has no column clipping, so a value that is wider than its column would run
// into the next one and the table would stop lining up.
function fit(doc, text, width) {
  if (doc.getTextWidth(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}...`) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut}...`;
}

function masthead(doc, report, first) {
  if (!first) {
    doc.setFillColor(...INK.heading);
    doc.rect(0, 0, PAGE_W, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('VanaDrishti AI', MARGIN, 7.8);
    doc.setFont('helvetica', 'normal');
    doc.text(fit(doc, clean(report.name), CONTENT_W - 60), PAGE_W - MARGIN, 7.8, { align: 'right' });
    return 22;
  }

  doc.setFillColor(...INK.heading);
  doc.rect(0, 0, PAGE_W, 40, 'F');
  doc.setFillColor(234, 247, 241);
  doc.circle(28, 20, 8.5, 'F');
  doc.setTextColor(...INK.heading);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('VD', 28, 23.4, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('VanaDrishti AI', MARGIN + 16, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(190, 224, 208);
  doc.text('Forest Loss Monitoring & Early Warning', MARGIN + 16, 24);
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(clean(`${report.type || 'Custom'} report`).toUpperCase(), PAGE_W - MARGIN, 15, { align: 'right' });
  doc.setTextColor(190, 224, 208);
  doc.text(clean(`Reference ${report.id}`), PAGE_W - MARGIN, 21, { align: 'right' });
  doc.text(clean(`Generated ${formatDate(report.generatedAt)}`), PAGE_W - MARGIN, 26, { align: 'right' });
  return 50;
}

function demoNotice(doc, y) {
  const lines = doc.splitTextToSize(
    clean(
      'DEMO NOTICE: every figure in this document is computed from illustrative sample records held in this browser. '
      + 'It contains no Sentinel-2 observation and no validated forest-loss measurement.',
    ),
    CONTENT_W - 8,
  );
  const height = lines.length * 4 + 6;
  doc.setFillColor(255, 247, 232);
  doc.setDrawColor(245, 226, 189);
  doc.roundedRect(MARGIN, y, CONTENT_W, height, 2, 2, 'F');
  doc.roundedRect(MARGIN, y, CONTENT_W, height, 2, 2, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(122, 74, 16);
  doc.text(lines, MARGIN + 4, y + 5.5);
  return y + height + 7;
}

function sectionTitle(doc, y, label) {
  doc.setDrawColor(...INK.heading);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y - 1.6, MARGIN + 5, y - 1.6);
  doc.setLineWidth(0.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK.heading);
  doc.text(clean(label).toUpperCase(), MARGIN + 7, y);
  return y + 5.5;
}

export function downloadReportPdf(report) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const facts = reportFacts(report);
  const region = REGIONS.find((item) => item.id === report.regionId);
  let y = masthead(doc, report, true);
  let first = true;

  const beginPage = () => {
    doc.addPage();
    first = false;
    y = masthead(doc, report, false);
  };
  const need = (space) => {
    if (y + space > FOOTER_TOP) beginPage();
  };

  doc.setTextColor(...INK.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(clean(report.name), CONTENT_W);
  need(titleLines.length * 6.6 + 4);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 6.6 + 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK.muted);
  const scope = [
    clean(`Region: ${report.regionName}`),
    clean(`State: ${report.state}`),
    clean(`Reporting period: ${formatDate(report.startDate)} to ${formatDate(report.endDate)}`),
  ];
  scope.forEach((line) => {
    need(5);
    doc.text(line, MARGIN, y);
    y += 4.8;
  });
  y += 5;

  y = demoNotice(doc, y);

  // Headline strip: all three cells are sums of the register printed below.
  const cells = [
    { label: 'Records in this report', value: String(facts.totalRecords) },
    { label: 'Reported loss area', value: `${number(facts.lossAreaKm2)} km2` },
    { label: 'Awaiting field review', value: String(facts.reviewCount) },
  ];
  need(26);
  const colW = CONTENT_W / cells.length;
  doc.setFillColor(244, 248, 247);
  doc.roundedRect(MARGIN, y, CONTENT_W, 22, 2.5, 2.5, 'F');
  doc.setDrawColor(220, 231, 229);
  doc.roundedRect(MARGIN, y, CONTENT_W, 22, 2.5, 2.5, 'S');
  cells.forEach((cell, index) => {
    const cx = MARGIN + colW * index + colW / 2;
    if (index > 0) {
      doc.setDrawColor(220, 231, 229);
      doc.line(MARGIN + colW * index, y + 4, MARGIN + colW * index, y + 18);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...INK.dark);
    doc.text(cell.value, cx, y + 10.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...INK.muted);
    doc.text(fit(doc, clean(cell.label).toUpperCase(), colW - 6), cx, y + 16.5, { align: 'center' });
  });
  y += 30;

  // Classification breakdown
  need(16);
  y = sectionTitle(doc, y, 'Classification breakdown');
  const breakdownCols = [
    { label: 'Class', width: 66, align: 'left' },
    { label: 'Records', width: 26, align: 'right' },
    { label: 'Area (km2)', width: 36, align: 'right' },
    { label: 'Share of area', width: 46, align: 'right' },
  ];
  const breakdownRows = facts.classes.map((item) => [
    item.classification,
    String(item.count),
    number(item.areaKm2),
    facts.totalAreaKm2 > 0 ? `${number((item.areaKm2 / facts.totalAreaKm2) * 100)}%` : '-',
  ]);
  breakdownRows.push(['Total', String(facts.totalRecords), number(facts.totalAreaKm2), '100.0%']);

  const drawTable = (cols, rows, options) => {
    const rowH = 6.4;
    const drawHeader = () => {
      need(rowH * 2);
      doc.setFillColor(232, 240, 237);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(...INK.dark);
      let x = MARGIN + 2;
      cols.forEach((col) => {
        const tx = col.align === 'right' ? x + col.width - 4 : x;
        doc.text(fit(doc, clean(col.label).toUpperCase(), col.width - 4), tx, y + 4.3, { align: col.align });
        x += col.width;
      });
      y += rowH;
    };
    drawHeader();
    rows.forEach((row, index) => {
      if (y + rowH > FOOTER_TOP) {
        beginPage();
        drawHeader();
      }
      const last = index === rows.length - 1 && options.totalRow;
      if (last) {
        doc.setFillColor(244, 248, 247);
        doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
      } else if (index % 2 === 1) {
        doc.setFillColor(249, 251, 250);
        doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
      }
      doc.setFont('helvetica', last ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...INK.body);
      let x = MARGIN + 2;
      row.forEach((value, column) => {
        const col = cols[column];
        const tx = col.align === 'right' ? x + col.width - 4 : x;
        if (options.swatch && column === 0 && CLASS_COLOR[value]) {
          const color = CLASS_COLOR[value];
          doc.setFillColor(...color);
          doc.circle(x + 1.4, y + rowH / 2, 1.2, 'F');
          doc.text(fit(doc, clean(value), col.width - 6), x + 4.4, y + 4.3);
        } else {
          doc.text(fit(doc, clean(value), col.width - 4), tx, y + 4.3, { align: col.align });
        }
        x += col.width;
      });
      y += rowH;
      doc.setDrawColor(234, 240, 238);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    });
    y += 8;
  };

  drawTable(breakdownCols, breakdownRows, { swatch: true, totalRow: true });

  // Detection register
  need(16);
  y = sectionTitle(doc, y, `Detection register (${facts.totalRecords} records)`);
  if (facts.records.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK.muted);
    doc.text(
      clean(`No detection record is held for ${report.regionName} in this browser's sample dataset.`),
      MARGIN,
      y + 3,
    );
    y += 12;
  } else {
    const registerCols = [
      { label: 'Location', width: 52, align: 'left' },
      { label: 'Class', width: 34, align: 'left' },
      { label: 'Area (km2)', width: 22, align: 'right' },
      { label: 'Conf.', width: 18, align: 'right' },
      { label: 'Observed', width: 24, align: 'right' },
      { label: 'Status', width: 24, align: 'left' },
    ];
    const registerRows = facts.records.map((record) => [
      clean(`${record.location}, ${record.district}`),
      record.classification,
      number(record.areaKm2),
      record.confidence == null ? '-' : `${Math.round(Number(record.confidence) * 100)}%`,
      formatDate(record.observationDate),
      record.status,
    ]);
    drawTable(registerCols, registerRows, { swatch: true, totalRow: false });
  }

  // Narrative sections
  REPORT_SECTIONS.forEach((title) => {
    const body = REPORT_COPY[title];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    const lines = doc.splitTextToSize(clean(body), CONTENT_W);
    need(lines.length * 4.4 + 12);
    y = sectionTitle(doc, y, title);
    doc.setFontSize(8.8);
    doc.setTextColor(...INK.body);
    lines.forEach((line) => {
      need(4.6);
      doc.text(line, MARGIN, y);
      y += 4.4;
    });
    y += 6;
  });

  if (region) {
    need(16);
    y = sectionTitle(doc, y, 'Study area definition');
    const metaCols = [
      { label: 'Attribute', width: 60, align: 'left' },
      { label: 'Value', width: 114, align: 'left' },
    ];
    const metaRows = [
      ['Sample study-area size', `${number(region.areaKm2)} km2`],
      ['Forest cover (reported)', `${number(region.forestCoverPercent)}%`],
      ['Elevation band', clean(region.elevation)],
      ['Location', clean(`${region.location}`)],
    ];
    drawTable(metaCols, metaRows, { swatch: false, totalRow: false });
  }

  // Footers are stamped once the page count is final, so the number is never a guess.
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(220, 231, 229);
    doc.line(MARGIN, FOOTER_TOP + 4, PAGE_W - MARGIN, FOOTER_TOP + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(120, 134, 148);
    doc.text(
      clean('VanaDrishti AI - illustrative demo report. No live satellite connection.'),
      MARGIN,
      FOOTER_TOP + 9,
    );
    doc.text(`Page ${page} of ${pages}`, PAGE_W - MARGIN, FOOTER_TOP + 9, { align: 'right' });
  }

  doc.save(`${safeFilename(report.name || 'vanadrishti-report')}.pdf`);
}
