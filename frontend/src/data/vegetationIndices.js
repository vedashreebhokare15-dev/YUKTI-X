export const VEGETATION_INDICES = [
  {
    id: 'NDVI',
    label: 'NDVI',
    fullName: 'Normalized Difference Vegetation Index',
    image: '/assets/ndvi-demo.svg',
    explanation: 'Vegetation greenness and vigor.',
    detail:
      'Higher values indicate dense, healthy canopy. Lower values can reflect bare soil, water or disturbed vegetation.',
    scale: { min: 'Low', max: 'High', minValue: '0.0', maxValue: '1.0' },
    isDemo: true,
  },
  {
    id: 'NDMI',
    label: 'NDMI',
    fullName: 'Normalized Difference Moisture Index',
    image: '/assets/ndmi-demo.svg',
    explanation: 'Vegetation moisture conditions.',
    detail:
      'Tracks canopy water content and can highlight drought stress before visible browning occurs.',
    scale: { min: 'Dry', max: 'Moist', minValue: '-1.0', maxValue: '1.0' },
    isDemo: true,
  },
  {
    id: 'NBR',
    label: 'NBR',
    fullName: 'Normalized Burn Ratio',
    image: '/assets/nbr-demo.svg',
    explanation: 'Burn-related and vegetation disturbance indicators.',
    detail:
      'Contrasts healthy vegetation with burned or disturbed areas and supports post-disturbance change detection.',
    scale: { min: 'Disturbed', max: 'Healthy', minValue: '-1.0', maxValue: '1.0' },
    isDemo: true,
  },
];
