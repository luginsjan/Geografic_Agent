const { connectToDatabase } = require('./mongodb.js');

const DEFAULT_ALLOWED_ORIGIN = process.env.CORS_ALLOW_ORIGIN || 'https://geografic-agent.vercel.app';
const DEFAULT_MANUAL_FLOW_MINUTES = Number.parseFloat(process.env.DASHBOARD_MANUAL_FLOW_MINUTES || '30');
const DEFAULT_TREND_DAYS = Number.parseInt(process.env.DASHBOARD_TREND_DAYS || '7', 10);
const DEFAULT_WEEK_WINDOW_DAYS = Number.parseInt(process.env.DASHBOARD_WEEK_WINDOW_DAYS || '7', 10);
const DEFAULT_MONTH_WINDOW_DAYS = Number.parseInt(process.env.DASHBOARD_MONTH_WINDOW_DAYS || '30', 10);
const DEFAULT_YEAR_WINDOW_DAYS = Number.parseInt(process.env.DASHBOARD_YEAR_WINDOW_DAYS || '365', 10);
const LOG_COLLECTION_NAME = process.env.LOG_COLLECTION_NAME || 'logs';
const DEFAULT_FETCH_LIMIT = Number.parseInt(
  process.env.LOG_FETCH_LIMIT || process.env.N8N_LOG_FETCH_LIMIT || '1000',
  10
);

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

function parseDurationToMinutes(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  const value = String(raw).trim();
  if (value === '') {
    return null;
  }
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  const durationRegex = /(?:(\d+)\s*(?:h|hr|hrs|hour|hours))?\s*(?:(\d+)\s*(?:m|min|mins|minute|minutes))?\s*(?:(\d+)\s*(?:s|sec|secs|second|seconds))?/i;
  const match = value.match(durationRegex);
  if (!match) {
    return null;
  }

  const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
  const seconds = match[3] ? Number.parseInt(match[3], 10) : 0;

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  const totalMinutes = hours * 60 + minutes + seconds / 60;
  return Number.isFinite(totalMinutes) ? totalMinutes : null;
}

function parseDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  const isoDate = new Date(trimmed);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Attempt to parse formats like "DD/MM/YYYY HH:mm:ss"
  const dateTimeParts = trimmed.split(/[\sT]+/);
  if (dateTimeParts.length >= 2) {
    const [datePart, timePart] = dateTimeParts;
    const dateSegments = datePart.split(/[/-]/);
    if (dateSegments.length === 3) {
      const [day, month, year] = dateSegments.map((segment) => Number.parseInt(segment, 10));
      if (
        Number.isFinite(day) &&
        Number.isFinite(month) &&
        Number.isFinite(year) &&
        day > 0 &&
        month > 0
      ) {
        const [hours = 0, minutes = 0, seconds = 0] = timePart
          .split(':')
          .map((segment) => Number.parseInt(segment, 10));
        const parsed = new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
  }

  return null;
}

function extractRowFields(row) {
  if (!row || typeof row !== 'object') {
    return {};
  }
  if (row.fields && typeof row.fields === 'object') {
    return row.fields;
  }
  if (row.data && typeof row.data === 'object') {
    return row.data;
  }
  if (row.json && typeof row.json === 'object') {
    return row.json;
  }
  return row;
}

function normalizeLogEntry(row) {
  const fields = extractRowFields(row);

  const timestamp =
    parseDate(fields.currentDate) ||
    parseDate(fields.executionDate) ||
    parseDate(row.currentDate) ||
    parseDate(row.executionDate) ||
    parseDate(row.createdAt) ||
    parseDate(fields.createdAt) ||
    null;

  const executionMinutes =
    parseDurationToMinutes(fields.ExecutionTime) ??
    parseDurationToMinutes(fields.executionTime) ??
    parseDurationToMinutes(fields.tiempoRequerido) ??
    parseDurationToMinutes(row.ExecutionTime) ??
    null;

  if (!timestamp) {
    return null;
  }

  return {
    timestamp,
    executionMinutes,
    aigentId: fields.AigentID || fields.agentId || null,
    clientAddress: fields.clientAdress || fields.clientAddress || null,
    bandwidth: fields.Bandwidth || fields.bandwidth || null,
    kitConfirmation:
      fields.kitConfirmation ||
      fields.kit ||
      fields.selectedKit ||
      row.kitConfirmation ||
      row.kit ||
      null
  };
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeAnalytics(entries, manualFlowMinutes, trendDays) {
  const now = new Date();
  const todayStart = startOfDay(now);

  const weekWindowDays = Math.max(DEFAULT_WEEK_WINDOW_DAYS, trendDays);
  const monthWindowDays = Math.max(DEFAULT_MONTH_WINDOW_DAYS, weekWindowDays);
  const yearWindowDays = Math.max(DEFAULT_YEAR_WINDOW_DAYS, monthWindowDays);

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - (weekWindowDays - 1));

  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - (monthWindowDays - 1));

  const yearStart = new Date(todayStart);
  yearStart.setDate(yearStart.getDate() - (yearWindowDays - 1));

  const metrics = {
    executions: {
      day: 0,
      week: 0,
      month: 0,
      year: 0
    },
    avgExecutionMinutes: 0,
    timeSavedMinutes: 0
  };

  const dailyBuckets = new Map();
  let totalExecutionMinutes = 0;
  let executionSamples = 0;
  let totalTimeSaved = 0;
  const kitCounts = new Map();

  entries.forEach((entry) => {
    if (!entry || !entry.timestamp) {
      return;
    }

    const entryDate = entry.timestamp;
    const entryDayStart = startOfDay(entryDate);
    const dateKey = formatDateKey(entryDayStart);

    const bucket = dailyBuckets.get(dateKey) || {
      date: entryDayStart,
      executions: 0,
      executionMinutesSum: 0,
      executionSamples: 0,
      timeSavedMinutes: 0
    };

    bucket.executions += 1;

    const hasValidExecutionTime = typeof entry.executionMinutes === 'number' && Number.isFinite(entry.executionMinutes);
    if (hasValidExecutionTime) {
      bucket.executionMinutesSum += entry.executionMinutes;
      bucket.executionSamples += 1;

      totalExecutionMinutes += entry.executionMinutes;
      executionSamples += 1;

      if (typeof manualFlowMinutes === 'number' && Number.isFinite(manualFlowMinutes)) {
        const saved = manualFlowMinutes - entry.executionMinutes;
        if (saved > 0) {
          bucket.timeSavedMinutes += saved;
          totalTimeSaved += saved;
        }
      }
    }

    dailyBuckets.set(dateKey, bucket);

    if (entryDate >= todayStart) {
      metrics.executions.day += 1;
    }
    if (entryDate >= weekStart) {
      metrics.executions.week += 1;
    }
    if (entryDate >= monthStart) {
      metrics.executions.month += 1;
    }
    if (entryDate >= yearStart) {
      metrics.executions.year += 1;
    }

    const kit = entry.kitConfirmation ? String(entry.kitConfirmation).trim() : '';
    if (kit) {
      kitCounts.set(kit, (kitCounts.get(kit) || 0) + 1);
    }
  });

  metrics.avgExecutionMinutes =
    executionSamples > 0 ? totalExecutionMinutes / executionSamples : 0;
  metrics.timeSavedMinutes = totalTimeSaved;

  const formatter = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });
  const trend = [];

  for (let offset = trendDays - 1; offset >= 0; offset -= 1) {
    const trendDate = new Date(todayStart);
    trendDate.setDate(trendDate.getDate() - offset);
    const key = formatDateKey(trendDate);
    const bucket = dailyBuckets.get(key);

    const avgMinutes =
      bucket && bucket.executionSamples > 0
        ? bucket.executionMinutesSum / bucket.executionSamples
        : 0;

    trend.push({
      date: key,
      label: formatter.format(trendDate),
      executions: bucket ? bucket.executions : 0,
      avgExecutionMinutes: avgMinutes,
      timeSavedMinutes: bucket ? bucket.timeSavedMinutes : 0
    });
  }

  return {
    metrics,
    trend,
    totals: {
      executions: entries.length,
      executionSamples,
      totalExecutionMinutes,
      totalTimeSavedMinutes: totalTimeSaved
    },
    popularKits: Array.from(kitCounts.entries())
      .map(([kit, count]) => ({
        kit,
        executions: count,
        ratio: entries.length > 0 ? count / entries.length : 0
      }))
      .sort((a, b) => b.executions - a.executions)
  };
}

async function fetchLogEntries() {
  const { db } = await connectToDatabase();
  const collection = db.collection(LOG_COLLECTION_NAME);

  const limit = Number.isFinite(DEFAULT_FETCH_LIMIT) && DEFAULT_FETCH_LIMIT > 0 ? DEFAULT_FETCH_LIMIT : 1000;

  const documents = await collection
    .find({})
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .toArray();

  return documents
    .map((doc) => normalizeLogEntry(doc))
    .filter((entry) => entry && entry.timestamp instanceof Date);
}

async function buildDashboardAnalytics() {
  const manualFlowMinutes = Number.isFinite(DEFAULT_MANUAL_FLOW_MINUTES)
    ? DEFAULT_MANUAL_FLOW_MINUTES
    : 30;
  const trendDays = Number.isFinite(DEFAULT_TREND_DAYS) && DEFAULT_TREND_DAYS > 0 ? DEFAULT_TREND_DAYS : 7;

  const entries = await fetchLogEntries();
  const analytics = computeAnalytics(entries, manualFlowMinutes, trendDays);

  return {
    manualFlowMinutes,
    trendDays,
    metrics: analytics.metrics,
    trend: analytics.trend,
    totals: analytics.totals,
    dataSource: {
      collection: LOG_COLLECTION_NAME,
      fetchLimit: DEFAULT_FETCH_LIMIT
    },
    popularKits: analytics.popularKits,
    updatedAt: new Date().toISOString()
  };
}

module.exports = async function handler(req, res) {
  const corsHeaders = toCorsHeaders(req.headers.origin || DEFAULT_ALLOWED_ORIGIN);
  Object.entries(corsHeaders).forEach(([header, value]) => {
    res.setHeader(header, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!ALLOWED_METHODS.includes(req.method)) {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Sólo se permiten peticiones GET para analytics del dashboard.'
    });
  }

  try {
    const analytics = await buildDashboardAnalytics();
    return res.status(200).json(analytics);
  } catch (error) {
    console.error('Dashboard analytics handler failed:', error);

    const status = error.status || (error.code === 'FETCH_TIMEOUT' ? 504 : 500);
    const payload = {
      error: 'Dashboard analytics error',
      message: error.message || 'No fue posible obtener los datos analíticos.',
      details: {}
    };

    if (error.status) {
      payload.details.httpStatus = error.status;
    }
    if (error.body) {
      payload.details.responseBody = error.body;
    }
    if (error.code) {
      payload.details.code = error.code;
    }

    return res.status(status).json(payload);
  }
};
