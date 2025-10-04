(function () {
    const DASHBOARD_STORAGE_KEY = 'agDashboardData';
    const DASHBOARD_TREND_PERIOD_LABEL = 'Últimos 7 días';

    const dashboardDatasetConfig = {
        kits: {
            label: 'Kits',
            singular: 'kit',
            fields: [
                { key: 'name', label: 'Nombre del kit', type: 'text', required: true, placeholder: 'Ej. Kit Urbano 5G' },
                { key: 'technology', label: 'Tecnología', type: 'text', required: true, placeholder: 'Ej. mmWave 28GHz' },
                { key: 'priceUsd', label: 'Precio (USD)', type: 'number', step: '0.01', min: 0, format: 'currency' },
                { key: 'leadTimeDays', label: 'Lead time (días)', type: 'number', step: '1', min: 0 },
                { key: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Uso recomendado, consideraciones u observaciones' }
            ]
        },
        prices: {
            label: 'Precios',
            singular: 'precio',
            fields: [
                { key: 'concept', label: 'Concepto', type: 'text', required: true, placeholder: 'Ej. Enlace dedicado 200 Mbps' },
                { key: 'amountUsd', label: 'Monto (USD)', type: 'number', step: '0.01', min: 0, required: true, format: 'currency' },
                { key: 'billingCycle', label: 'Ciclo de facturación', type: 'text', placeholder: 'Ej. Mensual, Único' },
                { key: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Condiciones o descuentos aplicables' }
            ]
        },
        antennas: {
            label: 'Antenas (SOP)',
            singular: 'antena',
            fields: [
                { key: 'sopCode', label: 'SOP', type: 'text', required: true, placeholder: 'Código SOP' },
                { key: 'plaza', label: 'Plaza', type: 'text', required: true, placeholder: 'Ciudad / Plaza' },
                { key: 'coordinates', label: 'Coordenadas', type: 'text', placeholder: 'Lat, Long' },
                { key: 'terrain', label: 'Terreno', type: 'text', placeholder: 'Urbano, Plano, etc.' },
                { key: 'heightMeters', label: 'Altura (mts)', type: 'number', step: '0.1', min: 0 }
            ]
        }
    };

    function normalizeAntennaEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            return entry;
        }
        const normalized = { ...entry };
        if (!normalized.plaza && normalized.location) {
            normalized.plaza = normalized.location;
        }
        if (normalized.status && !normalized.terrain) {
            normalized.terrain = normalized.status;
        }
        if (normalized.notes && !normalized.coordinates) {
            normalized.coordinates = normalized.notes;
        }
        if (normalized.height !== undefined && normalized.heightMeters === undefined) {
            normalized.heightMeters = normalized.height;
        }
        if (!normalized.coordinates && Array.isArray(normalized.coords)) {
            normalized.coordinates = normalized.coords.join(', ');
        }
        delete normalized.location;
        delete normalized.status;
        delete normalized.notes;
        delete normalized.height;
        delete normalized.coords;
        return normalized;
    }

    const defaultDashboardState = {
        activeType: 'kits',
        metrics: {
            executions: {
                day: 14,
                week: 86,
                month: 342,
                year: 3610
            },
            avgExecutionMinutes: 6.8,
            timeSavedMinutes: 210
        },
        trend: [
            { label: 'Lun', executions: 12, avgExecutionMinutes: 7.2, timeSavedMinutes: 36 },
            { label: 'Mar', executions: 14, avgExecutionMinutes: 6.9, timeSavedMinutes: 39 },
            { label: 'Mié', executions: 13, avgExecutionMinutes: 6.6, timeSavedMinutes: 42 },
            { label: 'Jue', executions: 15, avgExecutionMinutes: 6.7, timeSavedMinutes: 45 },
            { label: 'Vie', executions: 17, avgExecutionMinutes: 6.5, timeSavedMinutes: 48 },
            { label: 'Sáb', executions: 11, avgExecutionMinutes: 7.0, timeSavedMinutes: 34 },
            { label: 'Dom', executions: 9, avgExecutionMinutes: 6.4, timeSavedMinutes: 32 }
        ],
        data: {
            kits: [
                {
                    id: 'kit-1',
                    name: 'Kit Urbano 5G',
                    technology: '5G mmWave 28GHz',
                    priceUsd: 1420,
                    leadTimeDays: 7,
                    notes: 'Optimizado para densidad urbana con línea de vista clara.'
                },
                {
                    id: 'kit-2',
                    name: 'Kit Rural LTE',
                    technology: 'LTE 3.5GHz',
                    priceUsd: 980,
                    leadTimeDays: 12,
                    notes: 'Cobertura extendida para enlaces rurales de media distancia.'
                }
            ],
            prices: [
                {
                    id: 'price-1',
                    concept: 'Enlace dedicado 200 Mbps',
                    amountUsd: 450,
                    billingCycle: 'Mensual',
                    notes: 'Incluye soporte 24/7 y monitoreo proactivo.'
                },
                {
                    id: 'price-2',
                    concept: 'Instalación antena premium',
                    amountUsd: 320,
                    billingCycle: 'Único',
                    notes: 'Incluye alineación y certificación SOP.'
                }
            ],
            antennas: [
                {
                    id: 'antena-1',
                    sopCode: 'SOP-MX-014',
                    plaza: 'CDMX - Reforma',
                    coordinates: '19.4326, -99.1332',
                    terrain: 'Urbano',
                    heightMeters: 25
                },
                {
                    id: 'antena-2',
                    sopCode: 'SOP-MX-097',
                    plaza: 'Guadalajara - Zona Norte',
                    coordinates: '20.6597, -103.3496',
                    terrain: 'Semiurbano',
                    heightMeters: 18
                }
            ]
        }
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
                prices: Array.isArray(partial.data.prices) ? partial.data.prices : base.data.prices,
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
                metrics: dashboardState.metrics,
                trend: dashboardState.trend,
                data: dashboardState.data
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

    function handleDashboardFormSubmit(event) {
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
        const currentDataset = getCurrentDashboardDataset();
        const entryId = dashboardUI.entryIdInput.value;
        const payload = entryId ? currentDataset.find((item) => item.id === entryId) || { id: entryId } : { id: generateDashboardId(dashboardActiveType) };

        config.fields.forEach((field) => {
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

        const dataset = getCurrentDashboardDataset();
        const index = entryId ? dataset.findIndex((item) => item.id === entryId) : -1;

        if (index >= 0) {
            dataset[index] = { ...dataset[index], ...payload };
            setDashboardFeedback('Registro actualizado correctamente.', 'success');
        } else {
            dataset.push(payload);
            setDashboardFeedback('Nuevo registro agregado correctamente.', 'success');
        }

        const state = ensureDashboardState();
        state.data[dashboardActiveType] = dataset;
        state.activeType = dashboardActiveType;
        dashboardEditingId = null;
        saveDashboardState();
        renderDashboardTable();
        renderDashboardForm();
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
