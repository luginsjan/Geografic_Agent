const { connectToDatabase } = require('./mongodb.js');
const bcrypt = require('bcryptjs');

const DEFAULT_ALLOWED_ORIGIN = process.env.CORS_ALLOW_ORIGIN || 'https://geografic-agent.vercel.app';
const CREDENTIALS_COLLECTION = process.env.CREDENTIALS_COLLECTION || 'credentials';
const ALLOWED_METHODS = ['POST', 'OPTIONS'];

function toCorsHeaders(origin = DEFAULT_ALLOWED_ORIGIN) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };
}

function parseRequestBody(req) {
  if (req.body === undefined || req.body === null) {
    return {};
  }
  if (typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      throw new Error('Invalid JSON payload');
    }
  }
  throw new Error('Unsupported request body type');
}

function normalizeUsername(username) {
  return typeof username === 'string' ? username.trim() : '';
}

async function findCredentialDocument(collection, username) {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  return collection.findOne({
    $or: [
      { username: normalized },
      { username: lowered },
      { normalizedUsername: lowered }
    ]
  });
}

module.exports = async function handler(req, res) {
  const corsHeaders = toCorsHeaders(req.headers?.origin || DEFAULT_ALLOWED_ORIGIN);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!ALLOWED_METHODS.includes(req.method)) {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Sólo se permiten peticiones POST para iniciar sesión.'
    });
  }

  let body;
  try {
    body = parseRequestBody(req);
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid request body',
      message: error.message || 'El cuerpo de la petición no es un JSON válido.'
    });
  }

  const username = normalizeUsername(body.username);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    return res.status(400).json({
      error: 'Missing credentials',
      message: 'Debe proporcionar usuario y contraseña.'
    });
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(CREDENTIALS_COLLECTION);

    const credentialDoc = await findCredentialDocument(collection, username);

    if (!credentialDoc || !credentialDoc.passwordHash) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Credenciales inválidas.'
      });
    }

    const isMatch = await bcrypt.compare(password, credentialDoc.passwordHash);

    if (!isMatch) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Credenciales inválidas.'
      });
    }

    return res.status(200).json({
      authorized: true,
      username: credentialDoc.username || username
    });
  } catch (error) {
    console.error('[login] Authentication failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'No fue posible validar las credenciales.'
    });
  }
};
