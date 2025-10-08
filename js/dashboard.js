(function () {
    const DASHBOARD_STORAGE_KEY = 'agDashboardData';
    const DASHBOARD_TREND_PERIOD_LABEL = 'Últimos 7 días';
    const DASHBOARD_MANUAL_FLOW_MINUTES = 30;

    const dashboardDatasetConfig = {
        kits: {
            label: 'Kits',
            singular: 'kit',
            fields: [
                { key: 'kitId', label: 'ID del kit', type: 'text', required: true, placeholder: 'Ej. KIT-001' },
                { key: 'kitName', label: 'Nombre del kit', type: 'text', required: true, placeholder: 'Ej. Kit Urbano 5G' },
                { key: 'bandwidthMinMbps', label: 'Ancho de banda mínimo (Mbps)', type: 'number', step: '1', min: 0, format: 'decimal', minimumFractionDigits: 0 },
                { key: 'bandwidthMaxMbps', label: 'Ancho de banda máximo (Mbps)', type: 'number', step: '1', min: 0, format: 'decimal', minimumFractionDigits: 0 },
                { key: 'bandwidthRange', label: 'Rango de banda (texto)', type: 'text', readOnly: true, placeholder: 'Ej. 100-200 Mbps' },
                { key: 'distanceKm', label: 'Distancia (km)', type: 'number', step: '0.1', min: 0, format: 'decimal', minimumFractionDigits: 1 },
                { key: 'costUsd', label: 'Costo (USD)', type: 'number', step: '0.01', min: 0, format: 'currency' },
                { key: 'antennaBrand', label: 'Marca de antena', type: 'text', placeholder: 'Ej. Mimosa' },
                { key: 'antennaModel', label: 'Modelo de antena', type: 'text', placeholder: 'Ej. N5X25' },
                { key: 'antennaGainDbi', label: 'Ganancia antena (dBi)', type: 'number', step: '0.1', min: 0, format: 'decimal', minimumFractionDigits: 1 },
                { key: 'radiosSummary', label: 'Radios / Notas', type: 'textarea', placeholder: 'Modelos de radio, comentarios u observaciones' }
            ]
        },
        antennas: {
            label: 'Antenas (SOP)',
            singular: 'antena',
            fields: [
                { key: 'sopCode', label: 'SOP', type: 'text', required: true, placeholder: 'Código SOP' },
                { key: 'plaza', label: 'Plaza', type: 'text', required: true, placeholder: 'Ciudad / Plaza' },
                { key: 'coordinates', label: 'Coordenadas', type: 'text', placeholder: 'Lat, Long' },
                { key: 'terrain', label: 'Terreno', type: 'number', step: '1', min: 0, format: 'decimal', minimumFractionDigits: 0 },
                { key: 'heightMeters', label: 'Altura (mts)', type: 'number', step: '0.1', min: 0, format: 'decimal', minimumFractionDigits: 1 },
                { key: 'status', label: 'Estado', type: 'text', placeholder: 'Ej. active' }
            ]
        }
    };

    function normalizeAntennaEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            return entry;
        }
        const normalized = { ...entry };
        if (!normalized.sopCode && normalized.id) {
            normalized.sopCode = normalized.id;
        }
        if (!normalized.plaza && normalized.location) {
            normalized.plaza = normalized.location;
        }
        if (normalized.height !== undefined && normalized.heightMeters === undefined) {
            normalized.heightMeters = normalized.height;
        }
        if (!normalized.coordinates && Array.isArray(normalized.coords)) {
            normalized.coordinates = normalized.coords.join(', ');
        }
        if (!normalized.coordinates && normalized.latitude != null && normalized.longitude != null) {
            normalized.coordinates = `${normalized.latitude}, ${normalized.longitude}`;
        }
        if (normalized.Status && !normalized.status) {
            normalized.status = normalized.Status;
        }
        if (normalized.terrain !== undefined) {
            const parsedTerrain = Number(normalized.terrain);
            if (!Number.isNaN(parsedTerrain)) {
                normalized.terrain = parsedTerrain;
            }
        }
        if (normalized.heightMeters !== undefined) {
            const parsedHeight = Number(normalized.heightMeters);
            if (!Number.isNaN(parsedHeight)) {
                normalized.heightMeters = parsedHeight;
            }
        }
        delete normalized.location;
        delete normalized.height;
        delete normalized.coords;
        delete normalized.Status;
        return normalized;
    }

    const defaultDashboardState = {
        activeType: 'kits',
        manualFlowMinutes: DASHBOARD_MANUAL_FLOW_MINUTES,
        metrics: {
            executions: {
                day: 0,
                week: 0,
                month: 0,
                year: 0
            },
            avgExecutionMinutes: 0,
            timeSavedMinutes: 0
        },
        trend: [],
        data: {
            kits: [],
            antennas: []
        },
        analyticsTotals: null
    };

    let dashboardState = null;
    let dashboardActiveType = defaultDashboardState.activeType;
    let dashboardInitialized = false;
    let dashboardEditingId = null;
    let dashboardTrendChart = null;

    const dashboardUI = {
        metrics: {},
        tabButtons: [],
        form: null,
        formTitle: null,
        formFields: null,
        formFeedback: null,
        entryIdInput: null,
        resetButton: null,
        saveButton: null,
        saveButtonDefaultText: 'Guardar',
        addNewButton: null,
        tableHead: null,
        tableBody: null,
        emptyState: null,
        chartCanvas: null,
        chartLabel: null
    };

    function cloneDashboardState(source) {
        if (!source) {
            return JSON.parse(JSON.stringify(defaultDashboardState));
        }
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(source);
            } catch (error) {
                console.warn('structuredClone failed, falling back to JSON clone', error);
            }
        }
        return JSON.parse(JSON.stringify(source));
    }

    function mergeDashboardStateWithDefaults(partial) {
        const base = cloneDashboardState(defaultDashboardState);
        if (!partial || typeof partial !== 'object') {
            return base;
        }
        if (typeof partial.activeType === 'string' && dashboardDatasetConfig[partial.activeType]) {
            base.activeType = partial.activeType;
        }
        if (typeof partial.manualFlowMinutes === 'number' && Number.isFinite(partial.manualFlowMinutes)) {
            base.manualFlowMinutes = partial.manualFlowMinutes;
        }
        if (partial.analyticsTotals && typeof partial.analyticsTotals === 'object') {
            base.analyticsTotals = partial.analyticsTotals;
        }
        if (partial.metrics) {
            const incomingMetrics = partial.metrics;
            base.metrics = {
                ...base.metrics,
                ...incomingMetrics,
                executions: {
                    ...base.metrics.executions,
                    ...(incomingMetrics.executions || {})
                }
            };
        }
        if (Array.isArray(partial.trend) && partial.trend.length) {
            base.trend = partial.trend;
        }
        if (partial.data && typeof partial.data === 'object') {
            base.data = {
                kits: Array.isArray(partial.data.kits) ? partial.data.kits : base.data.kits,
                antennas: Array.isArray(partial.data.antennas)
                    ? partial.data.antennas.map(normalizeAntennaEntry)
                    : base.data.antennas
            };
        }
        base.data.antennas = base.data.antennas.map(normalizeAntennaEntry);
        return base;
    }

    function loadDashboardState() {
        try {
            const raw = localStorage.getItem(DASHBOARD_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return mergeDashboardStateWithDefaults(parsed);
            }
        } catch (error) {
            console.warn('No fue posible cargar los datos del dashboard desde almacenamiento local', error);
        }
        const state = cloneDashboardState(defaultDashboardState);
        state.data.antennas = state.data.antennas.map(normalizeAntennaEntry);
        return state;
    }

    function saveDashboardState() {
        try {
            if (!dashboardState) {
                return;
            }
            const serializable = {
                activeType: dashboardState.activeType,
                manualFlowMinutes: dashboardState.manualFlowMinutes,
                metrics: dashboardState.metrics,
                trend: dashboardState.trend,
                data: dashboardState.data,
                analyticsTotals: dashboardState.analyticsTotals
            };
            localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(serializable));
        } catch (error) {
            console.warn('No fue posible guardar los datos del dashboard', error);
        }
    }

    function ensureDashboardState() {
        if (!dashboardState) {
            dashboardState = loadDashboardState();
        }
        return dashboardState;
    }

    function generateDashboardId(prefix) {
        const safePrefix = prefix || 'entry';
        return `${safePrefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    function formatDashboardInteger(value) {
        if (value === null || value === undefined || value === '') {
            return '0';
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return String(value);
        }
        try {
            return numeric.toLocaleString('es-MX');
        } catch (error) {
            return numeric.toLocaleString();
        }
    }

    function formatDashboardDecimal(value, minimumFractionDigits = 1) {
        if (value === null || value === undefined || value === '') {
            return '0';
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return String(value);
        }
        const options = {
            minimumFractionDigits,
            maximumFractionDigits: Math.max(minimumFractionDigits, 2)
        };
        try {
            return numeric.toLocaleString('es-MX', options);
        } catch (error) {
            return numeric.toLocaleString(undefined, options);
        }
    }

    function formatDashboardCurrency(value) {
        if (value === null || value === undefined || value === '') {
            return '$0.00';
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return String(value);
        }
        const options = { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 };
        try {
            return numeric.toLocaleString('es-MX', options);
        } catch (error) {
            return numeric.toLocaleString(undefined, options);
        }
    }

    function formatMinutesToReadable(minutes) {
        if (minutes === null || minutes === undefined || minutes === '') {
            return '—';
        }
        const totalSeconds = Math.round(Number(minutes) * 60);
        if (!Number.isFinite(totalSeconds)) {
            return String(minutes);
        }
        const hours = Math.floor(totalSeconds / 3600);
        const remainingSeconds = totalSeconds % 3600;
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        const parts = [];
        if (hours > 0) {
            parts.push(`${hours}h`);
        }
        parts.push(`${mins}m`);
        if (hours === 0 && secs > 0) {
            parts.push(`${secs}s`);
        }
        return parts.join(' ');
    }

    function formatKitBandwidthRange(min, max) {
        const minValue = Number(min);
        const maxValue = Number(max);
        const hasMin = Number.isFinite(minValue);
        const hasMax = Number.isFinite(maxValue);
        if (hasMin && hasMax) {
            return `${formatDashboardInteger(minValue)}-${formatDashboardInteger(maxValue)} Mbps`;
        }
        if (hasMin) {
            return `${formatDashboardInteger(minValue)}+ Mbps`;
        }
        if (hasMax) {
            return `≤ ${formatDashboardInteger(maxValue)} Mbps`;
        }
        return 'No especificado';
    }

    function updateKitEntryDerivedFields(entry) {
        if (!entry || typeof entry !== 'object') {
            return;
        }
        const hasMin = entry.bandwidthMinMbps !== null && entry.bandwidthMinMbps !== undefined && entry.bandwidthMinMbps !== '';
        const hasMax = entry.bandwidthMaxMbps !== null && entry.bandwidthMaxMbps !== undefined && entry.bandwidthMaxMbps !== '';
        const min = hasMin ? Number(entry.bandwidthMinMbps) : null;
        const max = hasMax ? Number(entry.bandwidthMaxMbps) : null;
        entry.bandwidthMinMbps = Number.isFinite(min) ? min : null;
        entry.bandwidthMaxMbps = Number.isFinite(max) ? max : null;
        entry.bandwidthRange = formatKitBandwidthRange(entry.bandwidthMinMbps, entry.bandwidthMaxMbps);
        entry.antennaBrand = entry.antennaBrand ? String(entry.antennaBrand).trim() : null;
        if (entry.antennaBrand === '') {
            entry.antennaBrand = null;
        }
        entry.antennaModel = entry.antennaModel ? String(entry.antennaModel).trim() : null;
        if (entry.antennaModel === '') {
            entry.antennaModel = null;
        }
        const antennaParts = [entry.antennaBrand || '', entry.antennaModel || ''].filter(Boolean);
        if (antennaParts.length > 0) {
            entry.antenna = antennaParts.join(' ');
        } else if (!entry.antenna) {
            entry.antenna = null;
        }
        if (entry.radiosSummary) {
            entry.radiosSummary = String(entry.radiosSummary).trim();
        }
        entry.costUsd =
            entry.costUsd === null || entry.costUsd === undefined || entry.costUsd === ''
                ? null
                : Number(entry.costUsd);
        if (!Number.isFinite(entry.costUsd)) {
            entry.costUsd = null;
        }
        entry.antennaGainDbi =
            entry.antennaGainDbi === null || entry.antennaGainDbi === undefined || entry.antennaGainDbi === ''
                ? null
                : Number(entry.antennaGainDbi);
        if (!Number.isFinite(entry.antennaGainDbi)) {
            entry.antennaGainDbi = null;
        }
    }

    function parseCoordinateString(value) {
        if (!value || typeof value !== 'string') {
            return null;
        }
        const parts = value.split(',').map((part) => part.trim());
        if (parts.length !== 2) {
            return null;
        }
        const lat = Number(parts[0]);
        const lng = Number(parts[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
        }
        return { latitude: lat, longitude: lng };
    }

    function updateAntennaEntryDerivedFields(entry) {
        if (!entry || typeof entry !== 'object') {
            return;
        }
        let latitude = Number(entry.latitude);
        let longitude = Number(entry.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            const parsed = parseCoordinateString(entry.coordinates);
            if (parsed) {
                latitude = parsed.latitude;
                longitude = parsed.longitude;
            } else {
                latitude = null;
                longitude = null;
            }
        }
        entry.latitude = Number.isFinite(latitude) ? latitude : null;
        entry.longitude = Number.isFinite(longitude) ? longitude : null;
        if (entry.latitude !== null && entry.longitude !== null) {
            entry.coordinates = `${entry.latitude}, ${entry.longitude}`;
        } else if (!entry.coordinates) {
            entry.coordinates = null;
        }
        if (entry.terrain !== null && entry.terrain !== undefined) {
            const terrainNumber = Number(entry.terrain);
            entry.terrain = Number.isFinite(terrainNumber) ? terrainNumber : null;
        }
        if (entry.heightMeters !== null && entry.heightMeters !== undefined) {
            const heightNumber = Number(entry.heightMeters);
            entry.heightMeters = Number.isFinite(heightNumber) ? heightNumber : null;
        }
        if (entry.status) {
            entry.status = String(entry.status).trim();
        }
    }

    async function persistDashboardEntry(type, entry, mode) {
        if (typeof fetch !== 'function') {
            throw new Error('Fetch API no disponible para persistir datos.');
        }
        const method = mode === 'update' ? 'PUT' : 'POST';
        const response = await fetch('/api/dashboard-data', {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type, data: entry })
        });
        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            const message = errorPayload?.message || `Error HTTP ${response.status}`;
            const error = new Error(message);
            error.details = errorPayload;
            error.status = response.status;
            throw error;
        }
        return response.json();
    }

    function setDashboardSavingState(isSaving) {
        if (dashboardUI.saveButton) {
            dashboardUI.saveButton.disabled = Boolean(isSaving);
            dashboardUI.saveButton.textContent = isSaving ? 'Guardando…' : dashboardUI.saveButtonDefaultText || 'Guardar';
        }
        if (dashboardUI.resetButton) {
            dashboardUI.resetButton.disabled = Boolean(isSaving);
        }
        if (dashboardUI.addNewButton) {
            dashboardUI.addNewButton.disabled = Boolean(isSaving);
        }
    }

    async function fetchDashboardDataFromApi() {
        if (typeof fetch !== 'function') {
            console.warn('Fetch API no disponible en este entorno.');
            return;
        }
        try {
            const response = await fetch('/api/dashboard-data', { method: 'GET' });
            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status}`);
            }
            const payload = await response.json();
            const state = ensureDashboardState();

            if (Array.isArray(payload.kits)) {
                state.data.kits = payload.kits.map((kit) => {
                    const normalizedKit = { ...kit };
                    if (!normalizedKit.id) {
                        normalizedKit.id = normalizedKit.kitId || generateDashboardId('kit');
                    }
                    if (!normalizedKit.kitId) {
                        normalizedKit.kitId = normalizedKit.id;
                    }
                    return normalizedKit;
                });
            }

            if (Array.isArray(payload.antennas)) {
                state.data.antennas = payload.antennas.map((antenna) => {
                    const normalized = normalizeAntennaEntry({
                        ...antenna,
                        id: antenna.id || antenna.sopCode || generateDashboardId('antena')
                    });
                    if (!normalized.id) {
                        normalized.id = normalized.sopCode || generateDashboardId('antena');
                    }
                    if (!normalized.sopCode) {
                        normalized.sopCode = normalized.id;
                    }
                    return normalized;
                });
            }

            const hasData =
                (Array.isArray(payload.kits) && payload.kits.length > 0) ||
                (Array.isArray(payload.antennas) && payload.antennas.length > 0);

            saveDashboardState();
            refreshDashboard();
            if (dashboardUI.formFeedback && hasData) {
                setDashboardFeedback('Datos cargados desde la base de datos.', 'success');
            }
        } catch (error) {
            console.error('Error al cargar datos del dashboard desde la API', error);
            if (dashboardUI.formFeedback) {
                setDashboardFeedback('No se pudo cargar datos desde la base de datos.', 'error');
            }
        }
    }

    async function fetchDashboardAnalyticsFromApi() {
        if (typeof fetch !== 'function') {
            console.warn('Fetch API no disponible para cargar métricas del dashboard.');
            return;
        }
        try {
            const response = await fetch('/api/dashboard-analytics', { method: 'GET' });
            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status}`);
            }
            const payload = await response.json();
            const state = ensureDashboardState();

            if (payload.metrics && typeof payload.metrics === 'object') {
                state.metrics = {
                    ...state.metrics,
                    ...payload.metrics,
                    executions: {
                        ...state.metrics.executions,
                        ...(payload.metrics.executions || {})
                    }
                };
            }

            if (Array.isArray(payload.trend)) {
                state.trend = payload.trend;
            }

            if (typeof payload.manualFlowMinutes === 'number' && Number.isFinite(payload.manualFlowMinutes)) {
                state.manualFlowMinutes = payload.manualFlowMinutes;
            }

            if (payload.totals && typeof payload.totals === 'object') {
                state.analyticsTotals = payload.totals;
            }

            saveDashboardState();
            refreshDashboard();
        } catch (error) {
            console.error('Error al cargar métricas del dashboard desde la API', error);
        }
    }

    function initializeDashboardPage() {
        const dashboardSection = document.getElementById('dashboard');
        if (!dashboardSection) {
            return;
        }

        const state = ensureDashboardState();
        if (state.activeType && dashboardDatasetConfig[state.activeType]) {
            dashboardActiveType = state.activeType;
        } else {
            dashboardActiveType = defaultDashboardState.activeType;
            state.activeType = dashboardActiveType;
        }

        if (dashboardInitialized) {
            refreshDashboard();
            return;
        }

        dashboardUI.metrics.day = document.getElementById('metric-executions-day');
        dashboardUI.metrics.week = document.getElementById('metric-executions-week');
        dashboardUI.metrics.month = document.getElementById('metric-executions-month');
        dashboardUI.metrics.year = document.getElementById('metric-executions-year');
        dashboardUI.metrics.timePerExecution = document.getElementById('metric-time-per-execution');
        dashboardUI.metrics.timeSaved = document.getElementById('metric-time-saved');
        dashboardUI.chartCanvas = document.getElementById('executions-trend-chart');
        dashboardUI.chartLabel = document.getElementById('executions-chart-period');
        dashboardUI.tableHead = document.getElementById('dashboard-table-head');
        dashboardUI.tableBody = document.getElementById('dashboard-table-body');
        dashboardUI.emptyState = document.getElementById('dashboard-empty-state');
        dashboardUI.form = document.getElementById('dashboard-data-form');
        dashboardUI.formTitle = document.getElementById('dashboard-form-title');
        dashboardUI.formFields = document.getElementById('dashboard-form-fields');
        dashboardUI.formFeedback = document.getElementById('dashboard-form-feedback');
        dashboardUI.entryIdInput = document.getElementById('dashboard-entry-id');
        dashboardUI.resetButton = document.getElementById('dashboard-reset-button');
        dashboardUI.saveButton = document.getElementById('dashboard-save-button');
        if (dashboardUI.saveButton) {
            dashboardUI.saveButtonDefaultText = dashboardUI.saveButton.textContent || 'Guardar';
        }
        dashboardUI.addNewButton = document.getElementById('dashboard-add-new');
        dashboardUI.tabButtons = Array.from(document.querySelectorAll('.management-tab'));

        dashboardUI.tabButtons.forEach((button) => {
            button.addEventListener('click', handleDashboardTabClick);
        });

        if (dashboardUI.form) {
            dashboardUI.form.addEventListener('submit', handleDashboardFormSubmit);
        }

        if (dashboardUI.resetButton) {
            dashboardUI.resetButton.addEventListener('click', handleDashboardReset);
        }

        if (dashboardUI.addNewButton) {
            dashboardUI.addNewButton.addEventListener('click', handleDashboardAddNew);
        }

        if (dashboardUI.chartLabel) {
            dashboardUI.chartLabel.textContent = DASHBOARD_TREND_PERIOD_LABEL;
        }

        dashboardInitialized = true;
        refreshDashboard();
        fetchDashboardDataFromApi();
        fetchDashboardAnalyticsFromApi();
    }

    function refreshDashboard() {
        if (!dashboardInitialized) {
            return;
        }
        updateDashboardTabState();
        renderDashboardMetrics();
        renderDashboardTable();
        renderDashboardForm();
        renderDashboardChart();
    }

    function updateDashboardTabState() {
        if (!dashboardUI.tabButtons || dashboardUI.tabButtons.length === 0) {
            return;
        }
        dashboardUI.tabButtons.forEach((button) => {
            const isActive = button.dataset.type === dashboardActiveType;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    function renderDashboardMetrics() {
        const state = ensureDashboardState();
        const metrics = state.metrics || {};
        const executions = metrics.executions || {};

        if (dashboardUI.metrics.day) {
            dashboardUI.metrics.day.textContent = formatDashboardInteger(executions.day || 0);
        }
        if (dashboardUI.metrics.week) {
            dashboardUI.metrics.week.textContent = formatDashboardInteger(executions.week || 0);
        }
        if (dashboardUI.metrics.month) {
            dashboardUI.metrics.month.textContent = formatDashboardInteger(executions.month || 0);
        }
        if (dashboardUI.metrics.year) {
            dashboardUI.metrics.year.textContent = formatDashboardInteger(executions.year || 0);
        }
        if (dashboardUI.metrics.timePerExecution) {
            dashboardUI.metrics.timePerExecution.textContent = formatMinutesToReadable(metrics.avgExecutionMinutes);
        }
        if (dashboardUI.metrics.timeSaved) {
            dashboardUI.metrics.timeSaved.textContent = formatMinutesToReadable(metrics.timeSavedMinutes);
        }
    }

    function renderDashboardChart() {
        if (!dashboardUI.chartCanvas || typeof Chart === 'undefined') {
            return;
        }

        const state = ensureDashboardState();
        const trend = Array.isArray(state.trend) ? state.trend : [];
        const labels = trend.map((item) => item.label || '—');
        const executionValues = trend.map((item) => item.executions || 0);
        const avgExecutionValues = trend.map((item) => item.avgExecutionMinutes || 0);
        const timeSavedValues = trend.map((item) => item.timeSavedMinutes || 0);

        const chartData = {
            labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Ejecuciones',
                    data: executionValues,
                    borderColor: '#4FC3F7',
                    backgroundColor: 'rgba(79, 195, 247, 0.25)',
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'yExecutions'
                },
                {
                    type: 'line',
                    label: 'Tiempo por ejecución (min)',
                    data: avgExecutionValues,
                    borderColor: '#81C784',
                    backgroundColor: 'rgba(129, 199, 132, 0.25)',
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'yTime'
                },
                {
                    type: 'bar',
                    label: 'Tiempo ahorrado (min)',
                    data: timeSavedValues,
                    backgroundColor: 'rgba(255, 213, 79, 0.35)',
                    borderColor: 'rgba(255, 213, 79, 0.9)',
                    borderWidth: 1,
                    yAxisID: 'yTime',
                    order: 2
                }
            ]
        };

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.8,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                yExecutions: {
                    position: 'left',
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.08)'
                    },
                    ticks: {
                        color: '#ffffff'
                    }
                },
                yTime: {
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        color: '#ffffff'
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.08)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                }
            }
        };

        if (!dashboardTrendChart) {
            const context = dashboardUI.chartCanvas.getContext('2d');
            dashboardTrendChart = new Chart(context, {
                type: 'line',
                data: chartData,
                options: chartOptions
            });
        } else {
            dashboardTrendChart.data.labels = chartData.labels;
            chartData.datasets.forEach((dataset, index) => {
                if (dashboardTrendChart.data.datasets[index]) {
                    dashboardTrendChart.data.datasets[index].data = dataset.data;
                }
            });
            dashboardTrendChart.update();
        }
    }

    function getCurrentDashboardDataset() {
        const state = ensureDashboardState();
        const datasets = state.data || {};
        const dataset = datasets[dashboardActiveType];
        return Array.isArray(dataset) ? dataset : [];
    }

    function renderDashboardTable() {
        const config = dashboardDatasetConfig[dashboardActiveType];
        if (!config || !dashboardUI.tableHead || !dashboardUI.tableBody) {
            return;
        }

        const dataset = getCurrentDashboardDataset();

        dashboardUI.tableHead.innerHTML = '';
        const headerRow = document.createElement('tr');
        config.fields.forEach((field) => {
            const th = document.createElement('th');
            th.textContent = field.label;
            headerRow.appendChild(th);
        });
        const thActions = document.createElement('th');
        thActions.textContent = 'Acciones';
        headerRow.appendChild(thActions);
        dashboardUI.tableHead.appendChild(headerRow);

        dashboardUI.tableBody.innerHTML = '';

        if (dataset.length === 0) {
            if (dashboardUI.emptyState) {
                dashboardUI.emptyState.hidden = false;
            }
            return;
        }

        if (dashboardUI.emptyState) {
            dashboardUI.emptyState.hidden = true;
        }

        dataset.forEach((item) => {
            const tr = document.createElement('tr');
            config.fields.forEach((field) => {
                const td = document.createElement('td');
                td.textContent = formatDashboardFieldValue(field, item[field.key]);
                tr.appendChild(td);
            });

            const actionsTd = document.createElement('td');
            const actionsWrapper = document.createElement('div');
            actionsWrapper.className = 'table-actions';

            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'table-action';
            editButton.textContent = 'Editar';
            editButton.addEventListener('click', () => editDashboardEntry(item.id));

            actionsWrapper.appendChild(editButton);
            actionsTd.appendChild(actionsWrapper);
            tr.appendChild(actionsTd);

            dashboardUI.tableBody.appendChild(tr);
        });
    }

    function formatDashboardFieldValue(field, value) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }
        if (field.type === 'number') {
            if (field.format === 'currency') {
                return formatDashboardCurrency(value);
            }
            if (field.format === 'decimal') {
                const minDigits = typeof field.minimumFractionDigits === 'number' ? field.minimumFractionDigits : 1;
                return formatDashboardDecimal(value, minDigits);
            }
            return formatDashboardDecimal(value, 0);
        }
        return String(value);
    }

    function renderDashboardForm() {
        const config = dashboardDatasetConfig[dashboardActiveType];
        if (!config || !dashboardUI.formFields || !dashboardUI.formTitle || !dashboardUI.entryIdInput) {
            return;
        }

        const dataset = getCurrentDashboardDataset();
        const entry = dashboardEditingId ? dataset.find((item) => item.id === dashboardEditingId) : null;

        dashboardUI.formFields.innerHTML = '';
        dashboardUI.entryIdInput.value = entry?.id || '';
        dashboardUI.formTitle.textContent = entry ? `Editar ${config.singular}` : `Nuevo ${config.singular}`;
        setDashboardFeedback('');

        config.fields.forEach((field) => {
            if (field.readOnly) {
                return;
            }
            const wrapper = document.createElement('div');
            wrapper.className = 'form-field';

            const label = document.createElement('label');
            const inputId = `dashboard-field-${dashboardActiveType}-${field.key}`;
            label.setAttribute('for', inputId);
            label.textContent = field.label;

            let input;
            if (field.type === 'textarea') {
                input = document.createElement('textarea');
            } else {
                input = document.createElement('input');
                input.type = field.type || 'text';
                if (field.step) {
                    input.step = field.step;
                }
                if (field.min !== undefined) {
                    input.min = String(field.min);
                }
            }
            input.id = inputId;
            input.name = field.key;
            input.placeholder = field.placeholder || '';
            input.required = Boolean(field.required);
            input.autocomplete = 'off';

            const rawValue = entry ? entry[field.key] : '';
            if (field.type === 'number') {
                input.value = rawValue !== null && rawValue !== undefined ? String(rawValue) : '';
            } else {
                input.value = rawValue ? String(rawValue) : '';
            }

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            dashboardUI.formFields.appendChild(wrapper);
        });
    }

    function setDashboardFeedback(message, type) {
        if (!dashboardUI.formFeedback) {
            return;
        }
        dashboardUI.formFeedback.textContent = message || '';
        dashboardUI.formFeedback.classList.remove('success', 'error');
        if (type) {
            dashboardUI.formFeedback.classList.add(type);
        }
    }

    async function handleDashboardFormSubmit(event) {
        event.preventDefault();
        if (!dashboardUI.form || !dashboardUI.entryIdInput) {
            return;
        }
        if (!dashboardUI.form.checkValidity()) {
            dashboardUI.form.reportValidity();
            return;
        }

        const config = dashboardDatasetConfig[dashboardActiveType];
        if (!config) {
            return;
        }

        const formData = new FormData(dashboardUI.form);
        const entryId = dashboardUI.entryIdInput.value;
        const dataset = getCurrentDashboardDataset();
        const existingIndex = entryId ? dataset.findIndex((item) => item.id === entryId) : -1;
        const existingEntry = existingIndex >= 0 ? dataset[existingIndex] : null;
        const payloadBaseId = entryId || generateDashboardId(dashboardActiveType);
        const payload = existingEntry ? { ...existingEntry } : { id: payloadBaseId };

        config.fields.forEach((field) => {
            if (field.readOnly) {
                return;
            }
            const raw = formData.get(field.key);
            let value = raw != null ? String(raw).trim() : '';
            if (field.type === 'number') {
                if (value === '') {
                    payload[field.key] = null;
                } else {
                    const parsed = Number(value);
                    payload[field.key] = Number.isFinite(parsed) ? parsed : null;
                }
            } else {
                payload[field.key] = value;
            }
        });

        if (dashboardActiveType === 'kits') {
            payload.id = payload.kitId || payload.id;
            updateKitEntryDerivedFields(payload);
        } else if (dashboardActiveType === 'antennas') {
            payload.id = payload.sopCode || payload.id;
            updateAntennaEntryDerivedFields(payload);
        }

        const mode = existingEntry ? 'update' : 'create';
        setDashboardSavingState(true);

        try {
            const response = await persistDashboardEntry(dashboardActiveType, payload, mode);
            const itemFromServer = response?.item;
            let normalizedItem = itemFromServer || payload;
            if (dashboardActiveType === 'antennas') {
                normalizedItem = normalizeAntennaEntry(normalizedItem);
            }
            if (!normalizedItem.id) {
                normalizedItem.id = normalizedItem.kitId || normalizedItem.sopCode || payload.id;
            }

            if (existingEntry) {
                dataset[existingIndex] = { ...normalizedItem };
                setDashboardFeedback('Registro actualizado correctamente en la base de datos.', 'success');
            } else {
                dataset.push({ ...normalizedItem });
                setDashboardFeedback('Nuevo registro agregado correctamente en la base de datos.', 'success');
            }

            const state = ensureDashboardState();
            state.data[dashboardActiveType] = dataset;
            state.activeType = dashboardActiveType;
            dashboardEditingId = null;
            saveDashboardState();
            renderDashboardTable();
            renderDashboardForm();
        } catch (error) {
            console.error('No se pudo guardar el registro en la base de datos:', error);
            const message = error?.message || 'No se pudo guardar el registro en la base de datos.';
            setDashboardFeedback(message, 'error');
        } finally {
            setDashboardSavingState(false);
        }
    }

    function handleDashboardReset() {
        dashboardEditingId = null;
        renderDashboardForm();
    }

    function handleDashboardAddNew() {
        dashboardEditingId = null;
        renderDashboardForm();
        setDashboardFeedback('Formulario listo para un nuevo registro.');
    }

    function handleDashboardTabClick(event) {
        const button = event.currentTarget;
        if (!button || !button.dataset.type) {
            return;
        }
        const newType = button.dataset.type;
        if (!dashboardDatasetConfig[newType] || dashboardActiveType === newType) {
            return;
        }
        dashboardActiveType = newType;
        dashboardEditingId = null;
        const state = ensureDashboardState();
        state.activeType = newType;
        saveDashboardState();
        refreshDashboard();
    }

    function editDashboardEntry(entryId) {
        const dataset = getCurrentDashboardDataset();
        const entry = dataset.find((item) => item.id === entryId);
        if (!entry) {
            return;
        }
        dashboardEditingId = entryId;
        renderDashboardForm();
        setDashboardFeedback('Editando registro seleccionado.');
    }

    function initializeNavigation() {
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        if (!hamburger || !navMenu) {
            return;
        }

        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        document.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initializeNavigation();
        initializeDashboardPage();
    });
})();
