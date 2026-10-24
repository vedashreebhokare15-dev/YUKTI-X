export const REPORT_TYPES = ['Summary', 'Spatial', 'Trend', 'Vegetation', 'Alert', 'Custom'];

export const SAMPLE_REPORTS = [
  {
    id: 'report-001',
    name: 'Forest Loss Summary Report',
    type: 'Summary',
    regionId: 'region-melghat',
    regionName: 'Melghat Forest Landscape',
    state: 'Maharashtra',
    startDate: '2024-06-01',
    endDate: '2024-11-30',
    generatedAt: '2024-12-04T09:15:00.000Z',
    sizeMb: 2.4,
    downloads: 14,
    isDemo: true,
  },
  {
    id: 'report-002',
    name: 'Spatial Analysis Report',
    type: 'Spatial',
    regionId: 'region-mulshi',
    regionName: 'Mulshi Forest Range',
    state: 'Maharashtra',
    startDate: '2024-05-01',
    endDate: '2024-10-31',
    generatedAt: '2024-11-29T13:40:00.000Z',
    sizeMb: 3.8,
    downloads: 9,
    isDemo: true,
  },
  {
    id: 'report-003',
    name: 'Trend Analysis Report',
    type: 'Trend',
    regionId: 'region-satpura',
    regionName: 'Satpura Forest Landscape',
    state: 'Madhya Pradesh',
    startDate: '2024-01-01',
    endDate: '2024-11-30',
    generatedAt: '2024-11-22T10:05:00.000Z',
    sizeMb: 1.9,
    downloads: 17,
    isDemo: true,
  },
  {
    id: 'report-004',
    name: 'Vegetation Health Report',
    type: 'Vegetation',
    regionId: 'region-kanger',
    regionName: 'Kanger Valley Landscape',
    state: 'Chhattisgarh',
    startDate: '2024-04-01',
    endDate: '2024-10-31',
    generatedAt: '2024-11-16T16:30:00.000Z',
    sizeMb: 2.1,
    downloads: 6,
    isDemo: true,
  },
  {
    id: 'report-005',
    name: 'Alert Report',
    type: 'Alert',
    regionId: 'region-mawphlang',
    regionName: 'Mawphlang Forest Area',
    state: 'Meghalaya',
    startDate: '2024-08-01',
    endDate: '2024-11-10',
    generatedAt: '2024-11-12T07:55:00.000Z',
    sizeMb: 0.9,
    downloads: 11,
    isDemo: true,
  },
  {
    id: 'report-006',
    name: 'Custom Report',
    type: 'Custom',
    regionId: 'region-nainital',
    regionName: 'Nainital Forest Division',
    state: 'Uttarakhand',
    startDate: '2024-06-01',
    endDate: '2024-11-30',
    generatedAt: '2024-11-08T12:20:00.000Z',
    sizeMb: 1.5,
    downloads: 4,
    isDemo: true,
  },
];

export const REPORT_SECTIONS = [
  'Executive Summary',
  'Forest Loss Statistics',
  'Map Visualizations',
  'Charts and Graphs',
  'Key Findings',
  'Recommendations',
];

// The screen preview and the downloaded PDF must say the same thing, so the wording
// lives here once instead of being copied into both renderers.
export const REPORT_COPY = {
  'Executive Summary':
    'This demonstration report summarises the forest-monitoring workspace for the selected region. Every figure below is computed from the sample detection records listed in this document; none of them is a validated satellite measurement.',
  'Forest Loss Statistics':
    'The classification table adds up the detections listed in the register that follows it, so the area, count and share in each row reconcile with the rows above it. Percentages are of the reported detections, not of the forest area of the region.',
  'Map Visualizations':
    'The interactive workspace includes an illustrative study-area boundary, demonstration detection markers and layer controls. These geometries are not official forest boundaries or verified satellite detections.',
  'Charts and Graphs':
    'Trend, classification breakdown and regional coverage charts are available throughout the application. Measured output is produced by the Earth Engine pipeline in the backend repository and is not yet connected to these charts.',
  'Key Findings':
    'The sample dataset holds a small number of likely-loss and possible-loss records flagged for review, together with records whose confidence is reduced by simulated cloud cover or limited observations.',
  Recommendations:
    'Connect an authorised Sentinel-2 Level-2A data source, validate detections with field teams, and replace the illustrative boundaries and sample records in this document with backend-generated outputs before operational use.',
};

export const REPORT_TYPE_COLORS = {
  Summary: '#08764F',
  Spatial: '#0EA5A4',
  Trend: '#F59E0B',
  Vegetation: '#269B5B',
  Alert: '#EF4444',
  Custom: '#8A94A6',
};

export const REPORT_DATE_RANGES = [
  { id: 'all', label: 'All dates', days: null },
  { id: '30d', label: 'Past 30 days', days: 30 },
  { id: '90d', label: 'Past 90 days', days: 90 },
  { id: 'year', label: 'Past 12 months', days: 365 },
];
