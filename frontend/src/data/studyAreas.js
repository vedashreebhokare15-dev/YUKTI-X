const EARTH_KM_PER_DEG = 110.574;

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function ringFromCenter(center, radiusKm, seed, points = 18) {
  const [lat, lng] = center;
  const latRadius = radiusKm / EARTH_KM_PER_DEG;
  const lngRadius = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const ring = [];
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const wobble = 1 + 0.16 * Math.sin(angle * 3 + seed) + 0.07 * Math.cos(angle * 5 + seed * 1.7);
    const latitude = lat + Math.sin(angle) * latRadius * wobble;
    const longitude = lng + Math.cos(angle) * lngRadius * wobble;
    ring.push([round(longitude, 5), round(latitude, 5)]);
  }
  ring.push(ring[0]);
  return ring;
}

function makeBoundary(region) {
  return {
    type: 'Feature',
    properties: {
      name: region.name,
      state: region.state,
      district: region.district,
      illustrative: true,
      note: 'Illustrative boundary — not an official forest or administrative boundary.',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [ringFromCenter(region.center, region.radiusKm, region.seed)],
    },
  };
}

function offsetPoint([lat, lng], northKm, eastKm) {
  return [
    round(lat + northKm / EARTH_KM_PER_DEG, 5),
    round(lng + eastKm / (111.32 * Math.cos((lat * Math.PI) / 180)), 5),
  ];
}

function makeForestPatches(region) {
  const patches = [
    { north: 3.2, east: -2.4, radius: 0.46 },
    { north: -2.6, east: 3.1, radius: 0.4 },
    { north: -1.1, east: -4.2, radius: 0.3 },
  ];
  return {
    type: 'FeatureCollection',
    features: patches.map((patch, index) => {
      const center = offsetPoint(region.center, patch.north, patch.east);
      const radiusKm = Math.max(2.2, region.radiusKm * patch.radius);
      return {
        type: 'Feature',
        properties: { name: `${region.name} cover patch ${index + 1}`, illustrative: true },
        geometry: {
          type: 'Polygon',
          coordinates: [ringFromCenter(center, radiusKm, region.seed + index + 2, 14)],
        },
      };
    }),
  };
}

const BASE_REGIONS = [
  {
    id: 'region-mulshi',
    name: 'Mulshi Forest Range',
    state: 'Maharashtra',
    district: 'Pune',
    areaKm2: 352.6,
    forestCoverPercent: 81.4,
    elevation: '560 – 1,150 m',
    center: [18.49, 73.51],
    radiusKm: 13,
    seed: 3,
    featured: false,
    description:
      'A mosaic of moist deciduous forest, lateritic plateaus and reservoirs in the northern Western Ghats. The range links several protected patches across the Mulshi and Mula valleys.',
    importance:
      'Acts as a catchment for the Mula–Mutha river system, supports leopard, sambar and hornbill populations, and buffers the Pune metropolitan region against heat and flooding.',
    location: 'North-west of Pune city, Maharashtra',
  },
  {
    id: 'region-bhimashankar',
    name: 'Bhimashankar Wildlife Sanctuary',
    state: 'Maharashtra',
    district: 'Pune',
    areaKm2: 470.2,
    forestCoverPercent: 86.2,
    elevation: '600 – 1,280 m',
    center: [19.07, 73.54],
    radiusKm: 15,
    seed: 6,
    featured: false,
    description:
      'High-rainfall evergreen and semi-evergreen forest with rocky plateau edges and sacred groves. The sanctuary is a recognised biodiversity hotspot within the Western Ghats.',
    importance:
      'Core habitat of the Indian giant squirrel, home to rare medicinal plants, and a source of perennial streams feeding the Bhima basin.',
    location: 'Pune district, Maharashtra',
  },
  {
    id: 'region-melghat',
    name: 'Melghat Forest Landscape',
    state: 'Maharashtra',
    district: 'Amravati',
    areaKm2: 1248,
    forestCoverPercent: 78.6,
    elevation: '300 – 1,100 m',
    center: [21.41, 77.2],
    radiusKm: 23,
    seed: 9,
    featured: true,
    description:
      'Teak-dominated dry deciduous forest on the southern Satpura ranges, incised by seasonal streams and steep ravines. The landscape is a critical tiger corridor in central India.',
    importance:
      'Connects tiger populations across Maharashtra and Madhya Pradesh, sustains tribal forest livelihoods, and regulates water flow into the Tapi basin.',
    location: 'Amravati district, Maharashtra',
  },
  {
    id: 'region-satpura',
    name: 'Satpura Forest Landscape',
    state: 'Madhya Pradesh',
    district: 'Hoshangabad',
    areaKm2: 986.2,
    forestCoverPercent: 76.3,
    elevation: '320 – 1,350 m',
    center: [22.47, 78.43],
    radiusKm: 22,
    seed: 12,
    featured: true,
    description:
      'A rugged sandstone plateau covered with mixed deciduous forest, grass meadows and dense riparian corridors along the Denwa river.',
    importance:
      'A tiger and gaur stronghold, and a watershed feeding the Narmada tributaries. The landscape is a demonstration of adaptive forest management.',
    location: 'Hoshangabad district, Madhya Pradesh',
  },
  {
    id: 'region-kanger',
    name: 'Kanger Valley Landscape',
    state: 'Chhattisgarh',
    district: 'Bastar',
    areaKm2: 745.9,
    forestCoverPercent: 83.1,
    elevation: '380 – 900 m',
    center: [19.1, 81.78],
    radiusKm: 18,
    seed: 15,
    featured: true,
    description:
      'Dense moist deciduous and semi-evergreen forest with limestone caves, waterfalls and endemic subterranean fauna.',
    importance:
      'Protects one of the least fragmented forest blocks in Bastar, stabilises the Indravati catchment and supports endemic cave species.',
    location: 'Bastar district, Chhattisgarh',
  },
  {
    id: 'region-mawphlang',
    name: 'Mawphlang Forest Area',
    state: 'Meghalaya',
    district: 'East Khasi Hills',
    areaKm2: 512.4,
    forestCoverPercent: 88.4,
    elevation: '1,250 – 1,850 m',
    center: [25.45, 91.75],
    radiusKm: 15,
    seed: 18,
    featured: true,
    description:
      'Subtropical broadleaf forest surrounding the Mawphlang sacred grove, managed under traditional Khasi community institutions.',
    importance:
      'A living seed bank of indigenous species, a community-protected watershed, and a culturally significant sacred landscape.',
    location: 'East Khasi Hills district, Meghalaya',
  },
  {
    id: 'region-nainital',
    name: 'Nainital Forest Division',
    state: 'Uttarakhand',
    district: 'Nainital',
    areaKm2: 887.3,
    forestCoverPercent: 71.8,
    elevation: '1,100 – 2,600 m',
    center: [29.39, 79.45],
    radiusKm: 20,
    seed: 21,
    featured: true,
    description:
      'Himalayan chir pine, oak and mixed broadleaf forest across the Kumaon hills, interspersed with lakes, ridges and hill settlements.',
    importance:
      'Protects lake catchments around Nainital and Bhimtal, limits landslide risk and supports Himalayan bird and mammal populations.',
    location: 'Nainital district, Uttarakhand',
  },
];

export const REGIONS = BASE_REGIONS.map((region) => ({
  ...region,
  isDemo: true,
  image: '/assets/forest-landscape.png',
  boundary: makeBoundary(region),
  forestPatches: makeForestPatches(region),
}));

export const STATES = ['Maharashtra', 'Madhya Pradesh', 'Chhattisgarh', 'Meghalaya', 'Uttarakhand'];

export const STATE_FEATURED_REGION = {
  Maharashtra: 'region-melghat',
  'Madhya Pradesh': 'region-satpura',
  Chhattisgarh: 'region-kanger',
  Meghalaya: 'region-mawphlang',
  Uttarakhand: 'region-nainital',
};

export const REGION_SUMMARIES = {
  Maharashtra: {
    total: 1248,
    likely: 42.6,
    possible: 68.3,
    noLoss: 1093.7,
    insufficient: 43.4,
    observationDate: '2024-11-30',
    window: '01 Jun 2024 – 30 Nov 2024',
  },
  'Madhya Pradesh': {
    total: 986.2,
    likely: 31.8,
    possible: 54.7,
    noLoss: 861.3,
    insufficient: 38.4,
    observationDate: '2024-11-24',
    window: '01 Jun 2024 – 24 Nov 2024',
  },
  Chhattisgarh: {
    total: 745.9,
    likely: 26.4,
    possible: 41.2,
    noLoss: 651.8,
    insufficient: 26.5,
    observationDate: '2024-11-18',
    window: '01 Jun 2024 – 18 Nov 2024',
  },
  Meghalaya: {
    total: 512.4,
    likely: 18.6,
    possible: 29.8,
    noLoss: 447.2,
    insufficient: 16.8,
    observationDate: '2024-11-12',
    window: '01 Jun 2024 – 12 Nov 2024',
  },
  Uttarakhand: {
    total: 887.3,
    likely: 33.1,
    possible: 50.6,
    noLoss: 774.9,
    insufficient: 28.7,
    observationDate: '2024-11-26',
    window: '01 Jun 2024 – 26 Nov 2024',
  },
};

export const COMPOSITING_WINDOWS = ['1 month', '3 months', '6 months', '12 months'];

const COMPOSITE_FACTORS = {
  '1 month': 1,
  '3 months': 1.06,
  '6 months': 1.12,
  '12 months': 1.18,
};

const TREND_SHAPE = [
  { month: 'Jan', factor: 0.22 },
  { month: 'Mar', factor: 0.31 },
  { month: 'May', factor: 0.36 },
  { month: 'Jul', factor: 0.27 },
  { month: 'Sep', factor: 0.42 },
  { month: 'Nov', factor: 0.51 },
];

export function getTrendData(state, compositingWindow = '3 months') {
  const summary = REGION_SUMMARIES[state] || REGION_SUMMARIES.Maharashtra;
  const multiplier = COMPOSITE_FACTORS[compositingWindow] || 1;
  return TREND_SHAPE.map(({ month, factor }) => ({
    month,
    area: round(summary.likely * factor * multiplier, 1),
  }));
}

export function getRegionById(id) {
  return REGIONS.find((region) => region.id === id) || null;
}

export function getFeaturedRegion(state) {
  return getRegionById(STATE_FEATURED_REGION[state]) || REGIONS[0];
}

export function getDistricts(state) {
  return [...new Set(REGIONS.filter((region) => region.state === state).map((region) => region.district))];
}

export function getRegionsForDistrict(state, district) {
  return REGIONS.filter((region) => region.state === state && region.district === district);
}

export function getClassificationColor(classification) {
  switch (classification) {
    case 'Likely Forest Loss':
      return '#EF4444';
    case 'Possible Forest Loss':
      return '#F59E0B';
    case 'No Detected Loss':
      return '#269B5B';
    default:
      return '#8A94A6';
  }
}

export const CLASSIFICATIONS = [
  'Likely Forest Loss',
  'Possible Forest Loss',
  'No Detected Loss',
  'Insufficient Evidence',
];

export const SEED_SAVED_AREAS = [
  {
    id: 'saved-001',
    regionId: 'region-mulshi',
    regionName: 'Mulshi Forest Range',
    state: 'Maharashtra',
    district: 'Pune',
    startDate: '2024-06-01',
    endDate: '2024-11-30',
    areaKm2: 352.6,
    savedAt: '2024-12-01T09:30:00.000Z',
    isDemo: true,
  },
  {
    id: 'saved-002',
    regionId: 'region-melghat',
    regionName: 'Melghat Forest Landscape',
    state: 'Maharashtra',
    district: 'Amravati',
    startDate: '2024-05-15',
    endDate: '2024-11-15',
    areaKm2: 1248,
    savedAt: '2024-11-18T14:10:00.000Z',
    isDemo: true,
  },
  {
    id: 'saved-003',
    regionId: 'region-satpura',
    regionName: 'Satpura Forest Landscape',
    state: 'Madhya Pradesh',
    district: 'Hoshangabad',
    startDate: '2024-04-01',
    endDate: '2024-10-31',
    areaKm2: 986.2,
    savedAt: '2024-11-02T08:45:00.000Z',
    isDemo: true,
  },
];
