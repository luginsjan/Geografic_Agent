const { connectToDatabase } = require('./mongodb.js');

const ALLOWED_METHODS = ['GET', 'OPTIONS'];
const DEFAULT_ORIGIN = process.env.CORS_ALLOW_ORIGIN || 'https://geografic-agent.vercel.app';

function toCorsHeaders(origin = DEFAULT_ORIGIN) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };
}

function formatBandwidth(bandwidth = {}) {
  const min = bandwidth.min_mbps;
  const max = bandwidth.max_mbps;
  if (min && max) {
    return `${min}-${max} Mbps`;
  }
  if (min) {
    return `${min}+ Mbps`;
  }
  if (max) {
    return `≤ ${max} Mbps`;
  }
  return 'No especificado';
}

function mapKit(document) {
  const radios = Array.isArray(document.radios) ? document.radios : [];
  const radioModels = radios
    .map((radio) => radio.model || radio.name || radio.radio)
    .filter(Boolean);

  const antennaBrand = document.antenna?.brand;
  const antennaModel = document.antenna?.model;
  const antennaDescription = [antennaBrand, antennaModel].filter(Boolean).join(' ');

  let coordinates = null;
  if (document.antenna?.coordinates && Array.isArray(document.antenna.coordinates)) {
    const [lng, lat] = document.antenna.coordinates;
    if (lng !== undefined && lat !== undefined) {
      coordinates = { latitude: lat, longitude: lng };
    }
  }

  return {
    id: String(document._id),
    kitId: String(document._id),
    kitName: document.kit_name || '',
    bandwidthRange: formatBandwidth(document.bandwidth || {}),
    bandwidthMinMbps: document.bandwidth?.min_mbps ?? null,
    bandwidthMaxMbps: document.bandwidth?.max_mbps ?? null,
    distanceKm: document.distance_km ?? null,
    antenna: antennaDescription || null,
    antennaGainDbi: document.antenna?.gain_dbi ?? null,
    radiosSummary: radioModels.join(', ') || null,
    costUsd: document.cost_usd ?? null,
    linkBudgetDb: document.link_budget_db ?? null,
    coordinates
  };
}

function mapAntenna(document) {
  let coordinateString = null;
  let latitude = null;
  let longitude = null;

  const point = document.Coordinates;
  if (point && Array.isArray(point.coordinates)) {
    const [lng, lat] = point.coordinates;
    if (lng !== undefined && lat !== undefined) {
      latitude = lat;
      longitude = lng;
      coordinateString = `${lat}, ${lng}`;
    }
  }

  return {
    id: String(document._id),
    sopCode: String(document._id),
    plaza: document.Location || '',
    coordinates: coordinateString,
    latitude,
    longitude,
    terrain: document.Terrain ?? null,
    heightMeters: document.Height ?? null,
    status: document.Status || ''
  };
}

module.exports = async function handler(req, res) {
  const corsHeaders = toCorsHeaders(req.headers.origin || DEFAULT_ORIGIN);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (!ALLOWED_METHODS.includes(req.method)) {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET requests are supported for this endpoint'
    });
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { db } = await connectToDatabase();

    const equipmentCollection = db.collection('equipment');
    const antennasCollection = db.collection('antenas');

    const [kitsRaw, antennasRaw] = await Promise.all([
      equipmentCollection.find({}).toArray(),
      antennasCollection.find({}).toArray()
    ]);

    const kits = kitsRaw.map(mapKit);
    const antennas = antennasRaw.map(mapAntenna);

    return res.status(200).json({
      kits,
      antennas,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    return res.status(500).json({
      error: 'Failed to load dashboard data',
      message: error.message
    });
  }
};
