export const SAMPLE_ANALYSIS_RUNS = [
  {
    id: 'run-1042',
    regionId: 'region-melghat',
    regionName: 'Melghat Forest Landscape',
    state: 'Maharashtra',
    district: 'Amravati',
    startDate: '2024-06-01',
    endDate: '2024-11-30',
    compositingWindow: '3 months',
    algorithm: 'Random Forest',
    confidenceThreshold: 0.82,
    status: 'Completed',
    findings: 18,
    classification: 'Likely Forest Loss',
    createdAt: '2024-12-03T10:20:00.000Z',
    isDemo: true,
  },
  {
    id: 'run-1038',
    regionId: 'region-mulshi',
    regionName: 'Mulshi Forest Range',
    state: 'Maharashtra',
    district: 'Pune',
    startDate: '2024-05-01',
    endDate: '2024-10-31',
    compositingWindow: '6 months',
    algorithm: 'Threshold-based baseline',
    confidenceThreshold: 0.75,
    status: 'Completed',
    findings: 9,
    classification: 'Possible Forest Loss',
    createdAt: '2024-11-28T08:40:00.000Z',
    isDemo: true,
  },
  {
    id: 'run-1031',
    regionId: 'region-satpura',
    regionName: 'Satpura Forest Landscape',
    state: 'Madhya Pradesh',
    district: 'Hoshangabad',
    startDate: '2024-04-01',
    endDate: '2024-10-31',
    compositingWindow: '3 months',
    algorithm: 'Random Forest',
    confidenceThreshold: 0.8,
    status: 'Completed',
    findings: 12,
    classification: 'Possible Forest Loss',
    createdAt: '2024-11-20T15:05:00.000Z',
    isDemo: true,
  },
  {
    id: 'run-1026',
    regionId: 'region-bhimashankar',
    regionName: 'Bhimashankar Wildlife Sanctuary',
    state: 'Maharashtra',
    district: 'Pune',
    startDate: '2024-03-01',
    endDate: '2024-09-30',
    compositingWindow: '3 months',
    algorithm: 'Change detection baseline',
    confidenceThreshold: 0.7,
    status: 'Completed',
    findings: 6,
    classification: 'No Detected Loss',
    createdAt: '2024-11-12T11:35:00.000Z',
    isDemo: true,
  },
];

export const COMPOSITING_METHODS = [
  'Median',
  'Median with quality filtering',
  'Best available observation',
];

export const BASELINE_PERIODS = ['Previous year', 'Past 3 years', 'Past 5 years'];

export const SEASONAL_WINDOWS = ['Same season', 'Same season ± 1 month', 'Same season ± 2 months'];

export const ALGORITHMS = ['Random Forest', 'Threshold-based baseline', 'Change detection baseline'];

export const WORKFLOW_STEPS = [
  {
    id: 'collect',
    label: 'Data Collection',
    description: 'Sentinel-2 Level-2A',
    duration: 900,
  },
  {
    id: 'preprocess',
    label: 'Preprocessing',
    description: 'Resampling & alignment',
    duration: 800,
  },
  {
    id: 'cloud',
    label: 'Cloud Masking',
    description: 'Remove clouds & shadows',
    duration: 900,
  },
  {
    id: 'composite',
    label: 'Temporal Compositing',
    description: 'Create clearer observations',
    duration: 1000,
  },
  {
    id: 'seasonal',
    label: 'Seasonal Comparison',
    description: 'Compare similar seasons',
    duration: 900,
  },
  {
    id: 'detect',
    label: 'AI Detection',
    description: 'Apply selected model',
    duration: 1200,
  },
  {
    id: 'results',
    label: 'Results',
    description: 'Maps & reports',
    duration: 800,
  },
];
