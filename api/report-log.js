const { connectToDatabase } = require('./mongodb.js');

const DEFAULT_ALLOWED_ORIGIN = process.env.CORS_ALLOW_ORIGIN || 'https://geografic-agent.vercel.app';
const LOG_COLLECTION_NAME = process.env.LOG_COLLECTION_NAME || 'logs';
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
    console.warn('[report-log] Unable to parse query parameter:', error);
  }
  return null;
}

function sanitizeLogDocument(document) {
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
      message: 'Sólo se permiten peticiones GET para obtener el log del reporte.'
    });
  }

  const rawAigentId = normalizeQueryParam(req, 'aigentId') ||
    normalizeQueryParam(req, 'AigentID') ||
    normalizeQueryParam(req, 'id');

  const aigentId = typeof rawAigentId === 'string' ? rawAigentId.trim() : null;
  if (!aigentId) {
    return res.status(400).json({
      error: 'Missing identifier',
      message: 'Debe proporcionar el parámetro query "aigentId" para consultar el log.'
    });
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(LOG_COLLECTION_NAME);

    const logDocument = await collection
      .find({ AigentID: aigentId })
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
      .limit(1)
      .next();

    if (!logDocument) {
      return res.status(404).json({
        data: null,
        error: 'Not found',
        message: `No se encontró un log para el AigentID ${aigentId}.`
      });
    }

    return res.status(200).json({
      data: sanitizeLogDocument(logDocument)
    });
  } catch (error) {
    console.error('[report-log] Failed to fetch log entry:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'No fue posible obtener la información del log.'
    });
  }
};
