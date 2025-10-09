const DEFAULT_ALLOWED_ORIGIN = process.env.CORS_ALLOW_ORIGIN || 'https://geografic-agent.vercel.app';
const DEFAULT_MANUAL_FLOW_MINUTES = Number.parseFloat(process.env.DASHBOARD_MANUAL_FLOW_MINUTES || '30');
const DEFAULT_TREND_DAYS = Number.parseInt(process.env.DASHBOARD_TREND_DAYS || '7', 10);
const DEFAULT_WEEK_WINDOW_DAYS = Number.parseInt(process.env.DASHBOARD_WEEK_WINDOW_DAYS || '7', 10);
const DEFAULT_MONTH_WINDOW_DAYS = Number.parseInt(process.env.DASHBOARD_MONTH_WINDOW_DAYS || '30', 10);
const DEFAULT_YEAR_WINDOW_DAYS = Number.parseInt(process.env.DASHBOARD_YEAR_WINDOW_DAYS || '365', 10);
const DEFAULT_FETCH_LIMIT = Number.parseInt(process.env.N8N_LOG_FETCH_LIMIT || '500', 10);
const DEFAULT_FETCH_TIMEOUT_MS = Number.parseInt(process.env.N8N_API_TIMEOUT_MS || '15000', 10);

const N8N_API_KEY =
  process.env.N8N_API_KEY ||
  process.env.N8N_PERSONAL_ACCESS_TOKEN ||
  process.env.N8N_API_TOKEN ||
  null;
const N8N_API_BASE_URL = process.env.N8N_API_BASE_URL || 'https://aigentinc.app.n8n.cloud';
const N8N_PROJECT_ID = process.env.N8N_PROJECT_ID || 'MuE8xfSnYnRfOrWg';
const N8N_LOG_TABLE_ID = process.env.N8N_LOG_TABLE_ID || 'VUiSEAGTqXgEXXzh';
const N8N_LOG_DATA_URL =
  process.env.N8N_LOG_DATA_URL ||
  `${normalizeBaseUrl(N8N_API_BASE_URL)}/rest/projects/${N8N_PROJECT_ID}/datatables/${N8N_LOG_TABLE_ID}/data`;

const ALLOWED_METHODS = ['GET', 'OPTIONS'];

function normalizeBaseUrl(url) {
  if (!url) {
    return '';
  }
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

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
    bandwidth: fields.Bandwidth || fields.bandwidth || null
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
    }
  };
}

function extractRowsFromPayload(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    'data',
    'items',
    'rows',
    'records',
    'entries',
    'results',
    'values'
  ];

  for (const key of candidates) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
    if (payload[key] && typeof payload[key] === 'object') {
      for (const nestedKey of candidates) {
        if (Array.isArray(payload[key][nestedKey])) {
          return payload[key][nestedKey];
        }
      }
    }
  }

  if (payload?.data?.edges && Array.isArray(payload.data.edges)) {
    return payload.data.edges.map((edge) => edge.node || edge);
  }

  return [];
}

async function fetchLogEntries() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);

  try {
    const headers = {
      Accept: 'application/json'
    };

    if (N8N_API_KEY) {
      headers.Authorization = `Bearer ${N8N_API_KEY}`;
      headers['X-N8N-API-KEY'] = N8N_API_KEY;
    }

    const url = new URL(N8N_LOG_DATA_URL);
    if (!url.searchParams.has('take') && DEFAULT_FETCH_LIMIT > 0) {
      url.searchParams.set('take', String(DEFAULT_FETCH_LIMIT));
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    if (response.status === 404) {
      console.warn('XCIEN log datatable not found (HTTP 404). Returning empty analytics dataset.');
      return [];
    }

    if (!response.ok) {
      const error = new Error(`Failed to fetch XCIEN Log data: HTTP ${response.status}`);
      error.status = response.status;
      try {
        error.body = await response.text();
      } catch (bodyError) {
        error.body = null;
      }
      throw error;
    }

    const payload = await response.json();
    const rows = extractRowsFromPayload(payload);

    if (!Array.isArray(rows)) {
      return [];
    }

    const normalized = rows
      .map((row) => normalizeLogEntry(row))
      .filter((entry) => entry && entry.timestamp instanceof Date);

    return normalized;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request to fetch XCIEN Log data timed out');
      timeoutError.code = 'FETCH_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
      projectId: N8N_PROJECT_ID,
      tableId: N8N_LOG_TABLE_ID,
      fetchLimit: DEFAULT_FETCH_LIMIT
    },
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
    if (!N8N_LOG_DATA_URL) {
      return res.status(500).json({
        error: 'Missing configuration',
        message: 'La URL del Data Table XCIEN no está configurada (N8N_LOG_DATA_URL).'
      });
    }

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
