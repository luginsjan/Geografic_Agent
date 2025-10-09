const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('./mongodb.js');

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'OPTIONS'];
const DEFAULT_ORIGIN = process.env.CORS_ALLOW_ORIGIN || 'https://geografic-agent.vercel.app';

function toCorsHeaders(origin = DEFAULT_ORIGIN) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };
}

function formatBandwidth(bandwidth = {}) {
  const min = bandwidth.min_mbps;
  const max = bandwidth.max_mbps;
  const hasMin = min !== undefined && min !== null;
  const hasMax = max !== undefined && max !== null;
  if (hasMin && hasMax) {
    return `${min}-${max} Mbps`;
  }
  if (hasMin) {
    return `${min}+ Mbps`;
  }
  if (hasMax) {
    return `≤ ${max} Mbps`;
  }
  return 'No especificado';
}

function mapKit(document) {
  const radios = Array.isArray(document.radios) ? document.radios : [];
  const radioModels = radios
    .map((radio) => radio.model || radio.name || radio.radio)
    .filter(Boolean);

  const antennaBrand = document.antenna?.brand || null;
  const antennaModel = document.antenna?.model || null;
  const antennaDescription = document.antenna?.description || [antennaBrand, antennaModel].filter(Boolean).join(' ') || null;

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
    costUsd: document.cost_usd ?? null,
    linkBudgetDb: document.link_budget_db ?? null,
    antennaBrand,
    antennaModel,
    antenna: antennaDescription,
    antennaGainDbi: document.antenna?.gain_dbi ?? null,
    radiosSummary: document.radios_summary || (radioModels.join(', ') || null),
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

function mapPrice(document) {
  return {
    id: String(document._id),
    priceId: String(document._id),
    type: document.type || '',
    termMonths: document.term_months ?? null,
    speedMbps: document.speed_mbps ?? null,
    serviceCost: document.service_cost ?? null,
    installationCost: document.installation_cost ?? null
  };
}

function safeParseJson(raw) {
  if (raw == null) {
    return {};
  }
  if (typeof raw === 'object') {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('Invalid JSON payload');
  }
}

function sanitizeString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeId(value) {
  const sanitized = sanitizeString(value);
  return sanitized || null;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseCoordinatesString(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const parts = value.split(',').map((part) => part.trim());
  if (parts.length !== 2) {
    return null;
  }
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
}

function buildBandwidth(min, max) {
  if (min === null && max === null) {
    return null;
  }
  return {
    min_mbps: min,
    max_mbps: max
  };
}

function sanitizeKitPayload(data = {}) {
  const kitId = sanitizeId(data.kitId || data.id);
  const kitName = sanitizeString(data.kitName) || kitId;
  const distanceKm = toNullableNumber(data.distanceKm);
  const costUsd = toNullableNumber(data.costUsd);
  const linkBudgetDb = toNullableNumber(data.linkBudgetDb);
  const minBandwidth = toNullableNumber(data.bandwidthMinMbps);
  const maxBandwidth = toNullableNumber(data.bandwidthMaxMbps);

  const antennaBrand = sanitizeString(data.antennaBrand);
  const antennaModel = sanitizeString(data.antennaModel);
  const antennaGainDbi = toNullableNumber(data.antennaGainDbi);
  const antennaDescription = sanitizeString(data.antenna) || [antennaBrand, antennaModel].filter(Boolean).join(' ') || null;

  const antenna = {};
  if (antennaBrand) {
    antenna.brand = antennaBrand;
  }
  if (antennaModel) {
    antenna.model = antennaModel;
  }
  if (antennaGainDbi !== null) {
    antenna.gain_dbi = antennaGainDbi;
  }
  if (antennaDescription) {
    antenna.description = antennaDescription;
  }
  const antennaValue = Object.keys(antenna).length > 0 ? antenna : null;

  const radiosSummary = sanitizeString(data.radiosSummary);

  return {
    kitId,
    kitName,
    distanceKm,
    costUsd,
    linkBudgetDb,
    bandwidth: buildBandwidth(minBandwidth, maxBandwidth),
    antenna: antennaValue,
    radiosSummary
  };
}

function sanitizeAntennaPayload(data = {}) {
  const sopCode = sanitizeId(data.sopCode || data.id);
  const plaza = sanitizeString(data.plaza);
  const status = sanitizeString(data.status) || 'active';
  const terrain = toNullableNumber(data.terrain);
  const heightMeters = toNullableNumber(data.heightMeters);
  const latitude = toNullableNumber(data.latitude);
  const longitude = toNullableNumber(data.longitude);

  let coordinates = null;
  if (latitude !== null && longitude !== null) {
    coordinates = { type: 'Point', coordinates: [longitude, latitude] };
  } else {
    const parsed = parseCoordinatesString(data.coordinates);
    if (parsed) {
      coordinates = { type: 'Point', coordinates: [parsed.longitude, parsed.latitude] };
    }
  }

  return {
    sopCode,
    plaza,
    status,
    terrain,
    heightMeters,
    coordinates
  };
}

function buildKitUpdateFields(sanitized, timestamp) {
  return {
    kit_name: sanitized.kitName || '',
    distance_km: sanitized.distanceKm,
    cost_usd: sanitized.costUsd,
    link_budget_db: sanitized.linkBudgetDb,
    bandwidth: sanitized.bandwidth,
    antenna: sanitized.antenna,
    radios_summary: sanitized.radiosSummary,
    updatedAt: timestamp
  };
}

function buildKitInsertDocument(sanitized, timestamp) {
  return {
    _id: sanitized.kitId,
    ...buildKitUpdateFields(sanitized, timestamp),
    createdAt: timestamp
  };
}

function sanitizePricePayload(data = {}) {
  const priceId = sanitizeId(data.priceId || data.id);
  const type = sanitizeString(data.type);
  const termMonths = toNullableNumber(data.termMonths);
  const speedMbps = toNullableNumber(data.speedMbps);
  const serviceCost = toNullableNumber(data.serviceCost);
  const installationCost = toNullableNumber(data.installationCost);

  return {
    priceId,
    type,
    termMonths,
    speedMbps,
    serviceCost,
    installationCost
  };
}

function buildPriceUpdateFields(sanitized, timestamp) {
  return {
    type: sanitized.type || '',
    term_months: sanitized.termMonths,
    speed_mbps: sanitized.speedMbps,
    service_cost: sanitized.serviceCost,
    installation_cost: sanitized.installationCost,
    updatedAt: timestamp
  };
}

function buildPriceInsertDocument(sanitized, timestamp) {
  const base = buildPriceUpdateFields(sanitized, timestamp);
  const doc = {
    ...base,
    createdAt: timestamp
  };
  if (sanitized.priceId) {
    doc._id = ObjectId.isValid(sanitized.priceId)
      ? new ObjectId(sanitized.priceId)
      : sanitized.priceId;
  }
  return doc;
}

function buildPriceIdFilter(priceId) {
  if (!priceId) {
    return null;
  }
  if (ObjectId.isValid(priceId)) {
    return { _id: new ObjectId(priceId) };
  }
  return { _id: priceId };
}

function buildAntennaUpdateFields(sanitized, timestamp) {
  const update = {
    Location: sanitized.plaza || '',
    Terrain: sanitized.terrain,
    Height: sanitized.heightMeters,
    Status: sanitized.status || 'active',
    updatedAt: timestamp
  };
  update.Coordinates = sanitized.coordinates || null;
  return update;
}

function buildAntennaInsertDocument(sanitized, timestamp) {
  return {
    _id: sanitized.sopCode,
    ...buildAntennaUpdateFields(sanitized, timestamp),
    createdAt: timestamp
  };
}

async function handleGetRequest(res, db) {
  const equipmentCollection = db.collection('equipment');
  const pricesCollection = db.collection('prices');
  const antennasCollection = db.collection('antenas');

  const [kitsRaw, pricesRaw, antennasRaw] = await Promise.all([
    equipmentCollection.find({}).toArray(),
    pricesCollection.find({}).toArray(),
    antennasCollection.find({}).toArray()
  ]);

  const kits = kitsRaw.map(mapKit);
  const prices = pricesRaw.map(mapPrice);
  const antennas = antennasRaw.map(mapAntenna);

  return res.status(200).json({
    kits,
    prices,
    antennas,
    updatedAt: new Date().toISOString()
  });
}

async function handleKitWrite(method, payload, db, res) {
  const sanitized = sanitizeKitPayload(payload);
  if (!sanitized.kitId) {
    return res.status(400).json({
      error: 'Missing kit identifier',
      message: 'El campo kitId es obligatorio.'
    });
  }

  const equipmentCollection = db.collection('equipment');
  const now = new Date();

  if (method === 'POST') {
    const existing = await equipmentCollection.findOne({ _id: sanitized.kitId });
    if (existing) {
      return res.status(409).json({
        error: 'Kit already exists',
        message: `Ya existe un kit con ID ${sanitized.kitId}.`
      });
    }
    const insertDoc = buildKitInsertDocument(sanitized, now);
    await equipmentCollection.insertOne(insertDoc);
    const inserted = await equipmentCollection.findOne({ _id: sanitized.kitId });
    return res.status(201).json({
      item: mapKit(inserted)
    });
  }

  const updateResult = await equipmentCollection.updateOne(
    { _id: sanitized.kitId },
    { $set: buildKitUpdateFields(sanitized, now) }
  );

  if (updateResult.matchedCount === 0) {
    return res.status(404).json({
      error: 'Kit not found',
      message: `No se encontró un kit con ID ${sanitized.kitId}.`
    });
  }

  const updated = await equipmentCollection.findOne({ _id: sanitized.kitId });
  return res.status(200).json({
    item: mapKit(updated)
  });
}

async function handleAntennaWrite(method, payload, db, res) {
  const sanitized = sanitizeAntennaPayload(payload);
  if (!sanitized.sopCode) {
    return res.status(400).json({
      error: 'Missing SOP identifier',
      message: 'El campo sopCode es obligatorio.'
    });
  }

  const antennasCollection = db.collection('antenas');
  const now = new Date();

  if (method === 'POST') {
    const existing = await antennasCollection.findOne({ _id: sanitized.sopCode });
    if (existing) {
      return res.status(409).json({
        error: 'Antenna already exists',
        message: `Ya existe una antena con SOP ${sanitized.sopCode}.`
      });
    }
    const insertDoc = buildAntennaInsertDocument(sanitized, now);
    await antennasCollection.insertOne(insertDoc);
    const inserted = await antennasCollection.findOne({ _id: sanitized.sopCode });
    return res.status(201).json({
      item: mapAntenna(inserted)
    });
  }

  const updateResult = await antennasCollection.updateOne(
    { _id: sanitized.sopCode },
    { $set: buildAntennaUpdateFields(sanitized, now) }
  );

  if (updateResult.matchedCount === 0) {
    return res.status(404).json({
      error: 'Antenna not found',
      message: `No se encontró una antena con SOP ${sanitized.sopCode}.`
    });
  }

  const updated = await antennasCollection.findOne({ _id: sanitized.sopCode });
  return res.status(200).json({
    item: mapAntenna(updated)
  });
}

async function handlePriceWrite(method, payload, db, res) {
  const sanitized = sanitizePricePayload(payload);
  if (!sanitized.type) {
    return res.status(400).json({
      error: 'Missing price type',
      message: 'El campo tipo es obligatorio.'
    });
  }

  const pricesCollection = db.collection('prices');
  const now = new Date();

  if (method === 'POST') {
    if (sanitized.priceId) {
      const potentialFilter = buildPriceIdFilter(sanitized.priceId);
      if (potentialFilter) {
        const existing = await pricesCollection.findOne(potentialFilter);
        if (existing) {
          return res.status(409).json({
            error: 'Price already exists',
            message: `Ya existe un precio con identificador ${sanitized.priceId}.`
          });
        }
      }
    }
    const insertDoc = buildPriceInsertDocument(sanitized, now);
    const insertResult = await pricesCollection.insertOne(insertDoc);
    const lookupId = insertDoc._id ?? insertResult.insertedId;
    const inserted = await pricesCollection.findOne({ _id: lookupId });
    return res.status(201).json({
      item: mapPrice(inserted)
    });
  }

  const filter = buildPriceIdFilter(sanitized.priceId);
  if (!filter) {
    return res.status(400).json({
      error: 'Missing price identifier',
      message: 'Para actualizar es necesario especificar el identificador del precio.'
    });
  }

  const updateResult = await pricesCollection.updateOne(
    filter,
    { $set: buildPriceUpdateFields(sanitized, now) }
  );

  if (updateResult.matchedCount === 0) {
    return res.status(404).json({
      error: 'Price not found',
      message: 'No se encontró el precio solicitado.'
    });
  }

  const updated = await pricesCollection.findOne(filter);
  return res.status(200).json({
    item: mapPrice(updated)
  });
}

async function handleWriteRequest(req, res, db) {
  let body;
  try {
    body = safeParseJson(req.body);
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: error.message
    });
  }

  const type = body?.type;
  const data = body?.data;

  if (!type || !data) {
    return res.status(400).json({
      error: 'Invalid payload',
      message: 'Debe proporcionar el tipo de dataset y los datos a registrar.'
    });
  }

  if (type === 'kits') {
    return handleKitWrite(req.method, data, db, res);
  }

  if (type === 'prices') {
    return handlePriceWrite(req.method, data, db, res);
  }

  if (type === 'antennas') {
    return handleAntennaWrite(req.method, data, db, res);
  }

  return res.status(400).json({
    error: 'Unsupported dataset type',
    message: `El tipo de dataset "${type}" no es válido.`
  });
}

module.exports = async function handler(req, res) {
  const corsHeaders = toCorsHeaders(req.headers.origin || DEFAULT_ORIGIN);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!ALLOWED_METHODS.includes(req.method)) {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Método HTTP no soportado.'
    });
  }

  try {
    const { db } = await connectToDatabase();
    if (req.method === 'GET') {
      return handleGetRequest(res, db);
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      return handleWriteRequest(req, res, db);
    }
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Método HTTP no soportado.'
    });
  } catch (error) {
    console.error('Dashboard data handler failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
