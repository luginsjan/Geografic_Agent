const { connectToDatabase } = require('./mongodb.js');

const DEFAULT_ALLOWED_ORIGIN = process.env.CORS_ALLOW_ORIGIN || 'https://geografic-agent.vercel.app';
const EQUIPMENT_COLLECTION_NAME = 'equipment';
const ALLOWED_METHODS = ['GET', 'OPTIONS'];

function toCorsHeaders(origin = DEFAULT_ALLOWED_ORIGIN) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };
}

function normalizeQueryParam(req, key) {
  if (req?.query && Object.prototype.hasOwnProperty.call(req.query, key)) {
    return req.query[key];
  }
  try {
    if (req?.url) {
      const origin = req.headers?.origin || `http://${req.headers?.host || 'localhost'}`;
      const url = new URL(req.url, origin);
      if (url.searchParams.has(key)) {
        return url.searchParams.get(key);
      }
    }
  } catch (error) {
    console.warn('[equipment] Unable to parse query parameter:', error);
  }
  return null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildEquipmentFilter({ kitName, kitId }) {
  const filters = [];
  if (kitId) {
    filters.push({ _id: kitId });
    filters.push({ kit_id: kitId });
  }
  if (kitName) {
    filters.push({ kit_name: kitName });
    filters.push({ kit_name: { $regex: `^${escapeRegex(kitName)}$`, $options: 'i' } });
    filters.push({ KIT: kitName });
    filters.push({ KIT: { $regex: `^${escapeRegex(kitName)}$`, $options: 'i' } });
  }
  if (!filters.length) {
    return null;
  }
  return { $or: filters };
}

function sanitizeEquipmentDocument(document) {
  if (!document || typeof document !== 'object') {
    return null;
  }
  const { _id, ...rest } = document;
  return {
    id: _id ? String(_id) : null,
    ...rest
  };
}

module.exports = async function handler(req, res) {
  const corsHeaders = toCorsHeaders(req.headers?.origin || DEFAULT_ALLOWED_ORIGIN);
  Object.entries(corsHeaders).forEach(([header, value]) => {
    res.setHeader(header, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!ALLOWED_METHODS.includes(req.method)) {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Sólo se permiten peticiones GET para consultar equipos.'
    });
  }

  const rawKitName = normalizeQueryParam(req, 'kitName') ||
    normalizeQueryParam(req, 'name') ||
    normalizeQueryParam(req, 'kit');
  const rawKitId = normalizeQueryParam(req, 'kitId') ||
    normalizeQueryParam(req, 'id');

  const kitName = typeof rawKitName === 'string' ? rawKitName.trim() : null;
  const kitId = typeof rawKitId === 'string' ? rawKitId.trim() : null;

  const filter = buildEquipmentFilter({ kitName, kitId });
  if (!filter) {
    return res.status(400).json({
      error: 'Missing identifier',
      message: 'Debe proporcionar el parámetro query "kitName" o "kitId" para consultar un equipo.'
    });
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(EQUIPMENT_COLLECTION_NAME);

    const equipmentDocument = await collection.findOne(filter);

    if (!equipmentDocument) {
      return res.status(404).json({
        data: null,
        error: 'Not found',
        message: 'No se encontró un equipo que coincida con los parámetros proporcionados.'
      });
    }

    return res.status(200).json({
      data: sanitizeEquipmentDocument(equipmentDocument)
    });
  } catch (error) {
    console.error('[equipment] Failed to fetch equipment data:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'No fue posible obtener la información del equipo.'
    });
  }
};
