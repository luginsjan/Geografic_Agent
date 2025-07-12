// DOM Elements
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');
const navbar = document.querySelector('.navbar');
const sections = document.querySelectorAll('section');
const ctaButton = document.querySelector('.cta-button');
const contactForm = document.querySelector('.contact-form');
const clientCoordinatesFormBlock = document.querySelector('#client-coordinates-form-block');
const confirmAddressButton = document.querySelector('#confirm-address-button');
const appContainer = document.querySelector('#app-container');
const bandwidthInput = document.querySelector('#bandwidth-input');
const loadingBlock = document.querySelector('#loading-block');
const firstResultsBlock = document.querySelector('#first-results-block');
const statusMessage = document.getElementById('status-message');
const loadExampleButton = document.getElementById('load-example-button');
const aigentIdDisplay = document.querySelector('#aigent-id-display');
const aigentIdValue = document.querySelector('#aigent-id-value');
const recommendationBlock = document.querySelector('#recommendation-block');
const finalReportBlock = document.querySelector('#final-report-block');

// Store complete SOP data for each result
let allSopData = {};

// Store bandwidth value
let storedBandwidth = '';

// Store AigentID for workflow tracking
let currentAigentID = null;

// Store input data and confirmed selections for final report
let inputCoordinates = '';
let inputBandwidth = '';
let confirmedSOP = null;
let confirmedKit = null;

// Time tracking variables
let workflowStartTime = null;
let workflowEndTime = null;

// Function to update AigentID display
function updateAigentIDDisplay(aigentID) {
    if (aigentIdValue && aigentIdDisplay) {
        if (aigentID) {
            aigentIdValue.textContent = aigentID;
            aigentIdDisplay.style.display = 'block';
        } else {
            aigentIdValue.textContent = '-';
            aigentIdDisplay.style.display = 'none';
        }
    }
}

// Function to calculate time duration
function calculateTimeDuration(startTime, endTime) {
    if (!startTime || !endTime) return 'N/A';
    
    const duration = endTime - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        return `${remainingSeconds}s`;
    }
}

// Function to format timestamp
function formatTimestamp(date) {
    if (!date) return 'N/A';
    return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Function to validate and extract response data
function validateAndExtractResponseData(responseData) {
    console.log('Validating response data:', responseData);
    console.log('Response data type:', typeof responseData);
    console.log('Response data keys:', Object.keys(responseData));
    
    // Check if response has the new format with "0" key
    if (responseData["0"] && (responseData["0"].trueResults || responseData["0"].falseResults)) {
        console.log('Using new response format with "0" key');
        return {
            results: responseData["0"],
            aigentID: responseData.AigentID || null,
            format: 'new'
        };
    }
    // Fallback to old array format
    else if (Array.isArray(responseData) && responseData.length > 0) {
        console.log('Using legacy array response format');
        return {
            results: responseData[0],
            aigentID: responseData.AigentID || null,
            format: 'array'
        };
    }
    // Fallback to direct object format
    else if (responseData.trueResults || responseData.falseResults) {
        console.log('Using direct object response format');
        return {
            results: responseData,
            aigentID: responseData.AigentID || null,
            format: 'direct'
        };
    }
    
    // If none of the formats match, return null
    console.error('No valid response format found');
    return null;
}

// Function to handle confirmation button click
async function handleConfirmSelection() {
    const selectedCard = document.querySelector('.card.is-selected');
    if (!selectedCard) {
        showStatusMessage('No card selected', 'error');
        return;
    }

    // Extract the selected result ID (using data-sop as the identifier)
    // Note: The cards use data-sop attribute which contains the SOP number (e.g., "SOP-00008")
    // This serves as the unique identifier for each result
    const selectedResultId = selectedCard.dataset.sop;
    
    if (!selectedResultId) {
        showStatusMessage('Error: Could not identify selected result', 'error');
        return;
    }

    // Get the complete SOP data
    const completeSopData = allSopData[selectedResultId];
    
    if (!completeSopData) {
        showStatusMessage('Error: Complete SOP data not found', 'error');
        return;
    }
    
    // Store confirmed SOP for final report
    confirmedSOP = {
        id: selectedResultId,
        data: completeSopData
    };
    
    // Debug: Log the complete SOP data being sent (can be removed in production)
    console.log('Retrieved complete SOP data for', selectedResultId, ':', completeSopData);
    console.log('Bandwidth being sent:', storedBandwidth);

    // Prepare the request data with complete SOP information, bandwidth, and AigentID
    const requestData = {
        selectedResultId: selectedResultId,
        completeSopData: completeSopData, // Include the complete data
        bandwidth: storedBandwidth, // Include the stored bandwidth value
        AigentID: currentAigentID // Include the current AigentID
    };

    try {
        // Show loading animation immediately
        showSOPLoading();
        showStatusMessage('Sending selection to server...', 'info');
        
        // Send POST request to n8n selection webhook
        const response = await fetch(n8nSelectionWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`Server responded with error: ${response.status} ${response.statusText}`);
        }

        const responseData = await response.json();
        
        // Hide loading animation
        hideSOPLoading();
        
        // Log success with complete data
        console.log('Selection sent successfully:', responseData);
        console.log('Complete SOP data sent:', completeSopData);
        console.log('AigentID used:', currentAigentID);
        showStatusMessage(`Selection confirmed: ${selectedResultId}`, 'success');
        
        // Handle kit recommendations if present in response
        if (responseData) {
            let recommendationData = null;
            // Check if response has "0" key with output property (new format)
            if (responseData["0"] && responseData["0"].output) {
                recommendationData = responseData["0"].output;
            }
            // Check if response has output property (direct format)
            else if (responseData.output) {
                recommendationData = responseData.output;
            }
            // Check if response is an array with output property (array format)
            else if (Array.isArray(responseData) && responseData.length > 0 && responseData[0].output) {
                recommendationData = responseData[0].output;
            }
            // Check if response has the structure directly
            else if (responseData.viable_kits || responseData.high_reliability_recommendation || responseData.best_value_recommendation) {
                recommendationData = responseData;
            }
            if (recommendationData) {
                displayKitRecommendations(recommendationData);
            } else {
                console.log('No kit recommendations found in response:', responseData);
            }
        }
        
    } catch (error) {
        // Hide loading animation on error
        hideSOPLoading();
        
        // Log error
        console.error('Error sending selection:', error);
        showStatusMessage(`Error sending selection: ${error.message}`, 'error');
    } finally {
        // Always trigger the smooth closing of the first-results-block
        if (firstResultsBlock) {
            firstResultsBlock.classList.remove('visible');
            setTimeout(() => {
                firstResultsBlock.style.display = 'none';
                // Clear the results container
                const resultsContainer = firstResultsBlock.querySelector('.results-container');
                if (resultsContainer) {
                    resultsContainer.innerHTML = '';
                }
                // Reset the confirm button state
                const confirmButton = document.getElementById('confirm-selection-button');
                if (confirmButton) {
                    confirmButton.classList.remove('enabled');
                }
                // Show the form block again
                if (clientCoordinatesFormBlock) {
                    clientCoordinatesFormBlock.classList.remove('minimized');
                }
                // Hide any status messages after a delay
                setTimeout(() => {
                    hideStatusMessage();
                }, 3000);
            }, 500);
        }
    }
}

// Function to display kit recommendations
function displayKitRecommendations(recommendationData) {
    console.log('Displaying kit recommendations:', recommendationData);
    
    // Hide the first results block smoothly
    if (firstResultsBlock) {
        firstResultsBlock.classList.remove('visible');
        setTimeout(() => {
            firstResultsBlock.style.display = 'none';
            // Clear the results container
            const resultsContainer = firstResultsBlock.querySelector('.results-container');
            if (resultsContainer) {
                resultsContainer.innerHTML = '';
            }
            // Reset the confirm button state
            const confirmButton = document.getElementById('confirm-selection-button');
            if (confirmButton) {
                confirmButton.classList.remove('enabled');
            }
        }, 500);
    }
    
    // Show the recommendation block with loading state first
    if (recommendationBlock) {
        recommendationBlock.style.display = 'block';
        setTimeout(() => {
            recommendationBlock.classList.add('visible');
        }, 100);
    }
    
    // Show loading state initially
    const recommendationLoading = document.getElementById('recommendation-loading');
    const recommendationContent = document.getElementById('recommendation-content');
    
    if (recommendationLoading) {
        recommendationLoading.style.display = 'flex';
    }
    if (recommendationContent) {
        recommendationContent.style.display = 'none';
    }
    
    // Simulate loading time and then populate content
    setTimeout(() => {
        // Hide loading, show content
        if (recommendationLoading) {
            recommendationLoading.style.display = 'none';
        }
        if (recommendationContent) {
            recommendationContent.style.display = 'block';
            setTimeout(() => {
                recommendationContent.classList.add('visible');
            }, 50);
        }
        
        // Populate the recommendation block
        populateRecommendationBlock(recommendationData);
        
        // Initialize kit selection functionality
        initializeKitSelection();
        
    }, 1500); // 1.5 second loading animation
    
    // Scroll to the recommendation block
    setTimeout(() => {
        if (recommendationBlock) {
            window.scrollTo({
                top: recommendationBlock.getBoundingClientRect().top + window.scrollY - 30,
                behavior: 'smooth'
            });
        }
    }, 800);
}

// Function to initialize kit selection functionality
function initializeKitSelection() {
    const kitDropdown = document.getElementById('kit-dropdown');
    const kitCards = document.querySelectorAll('.kit-card');
    const confirmKitButton = document.getElementById('confirm-kit-selection-button');
    
    // Store selected kit data globally
    window.selectedKitData = null;
    
    // Add click event listeners to kit cards
    kitCards.forEach(card => {
        card.addEventListener('click', function() {
            const kitName = this.querySelector('h4').textContent;
            selectKit(kitName, card);
        });
    });
    
    // Add change event listener to dropdown
    if (kitDropdown) {
        kitDropdown.addEventListener('change', function() {
            const selectedKit = this.value;
            if (selectedKit) {
                selectKit(selectedKit);
            } else {
                deselectAllKits();
            }
        });
    }
    
    // Add click event listener to confirmation button
    if (confirmKitButton) {
        confirmKitButton.addEventListener('click', handleKitConfirmation);
    }
}

// Function to select a kit
function selectKit(kitName, clickedCard = null) {
    const kitDropdown = document.getElementById('kit-dropdown');
    const kitCards = document.querySelectorAll('.kit-card');
    const confirmKitButton = document.getElementById('confirm-kit-selection-button');
    
    // Update dropdown
    if (kitDropdown) {
        kitDropdown.value = kitName;
    }
    
    // Update card selection
    kitCards.forEach(card => {
        card.classList.remove('selected');
        card.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
    });
    
    // Find and select the clicked card or card matching the kit name
    let targetCard = clickedCard;
    if (!targetCard) {
        targetCard = Array.from(kitCards).find(card => 
            card.querySelector('h4').textContent === kitName
        );
    }
    
    if (targetCard) {
        targetCard.classList.add('selected');
        targetCard.style.borderColor = '#4CAF50';
        targetCard.style.transform = 'translateY(-4px)';
        targetCard.style.boxShadow = '0 12px 30px rgba(76, 175, 80, 0.3)';
    }
    
    // Store selected kit data
    const kitData = Array.from(kitCards).find(card => 
        card.querySelector('h4').textContent === kitName
    );
    
    if (kitData) {
        window.selectedKitData = {
            name: kitName,
            radio: kitData.querySelector('.kit-detail-item:nth-child(1) .kit-detail-value').textContent,
            antenna: kitData.querySelector('.kit-detail-item:nth-child(2) .kit-detail-value').textContent,
            frequency_band: kitData.querySelector('.kit-detail-item:nth-child(3) .kit-detail-value').textContent,
            max_throughput: kitData.querySelector('.kit-detail-item:nth-child(4) .kit-detail-value').textContent,
            transmit_power: kitData.querySelector('.kit-detail-item:nth-child(5) .kit-detail-value').textContent,
            antenna_gain: kitData.querySelector('.kit-detail-item:nth-child(6) .kit-detail-value').textContent,
            link_margin: kitData.querySelector('.kit-detail-item:nth-child(7) .kit-detail-value').textContent,
            cost: kitData.querySelector('.kit-detail-item:nth-child(8) .kit-detail-value').textContent
        };
    }
    
    // Enable confirmation button
    if (confirmKitButton) {
        confirmKitButton.disabled = false;
    }
}

// Function to deselect all kits
function deselectAllKits() {
    const kitCards = document.querySelectorAll('.kit-card');
    const confirmKitButton = document.getElementById('confirm-kit-selection-button');
    
    kitCards.forEach(card => {
        card.classList.remove('selected');
        card.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
    });
    
    // Disable confirmation button
    if (confirmKitButton) {
        confirmKitButton.disabled = true;
    }
    
    // Clear selected kit data
    window.selectedKitData = null;
}

// Function to show coordinate confirmation loading state
function showCoordinateLoading() {
    const loadingBlock = document.getElementById('loading-block');
    const loadingText = loadingBlock.querySelector('p');
    
    // Show loading block
    loadingBlock.style.display = 'block';
    setTimeout(() => {
        loadingBlock.classList.add('visible');
    }, 50);
    
    // Update loading text
    if (loadingText) {
        loadingText.textContent = 'Procesando datos geográficos...';
    }
}

// Function to hide coordinate confirmation loading state
function hideCoordinateLoading() {
    const loadingBlock = document.getElementById('loading-block');
    
    // Hide loading block
    loadingBlock.classList.remove('visible');
    setTimeout(() => {
        loadingBlock.style.display = 'none';
    }, 600);
}

// Function to show SOP confirmation loading state
function showSOPLoading() {
    const loadingBlock = document.getElementById('loading-block');
    const loadingText = loadingBlock.querySelector('p');
    
    // Show loading block
    loadingBlock.style.display = 'block';
    setTimeout(() => {
        loadingBlock.classList.add('visible');
    }, 50);
    
    // Update loading text
    if (loadingText) {
        loadingText.textContent = 'Procesando selección de SOP...';
    }
}

// Function to hide SOP confirmation loading state
function hideSOPLoading() {
    const loadingBlock = document.getElementById('loading-block');
    
    // Hide loading block
    loadingBlock.classList.remove('visible');
    setTimeout(() => {
        loadingBlock.style.display = 'none';
    }, 600);
}

// Function to show kit confirmation loading state
function showKitConfirmationLoading() {
    const recommendationLoading = document.getElementById('recommendation-loading');
    const recommendationContent = document.getElementById('recommendation-content');
    
    // Show loading state
    if (recommendationLoading) {
        recommendationLoading.style.display = 'flex';
        // Update loading text for kit confirmation
        const loadingText = recommendationLoading.querySelector('p');
        if (loadingText) {
            loadingText.textContent = 'Confirmando selección de kit...';
        }
    }
    if (recommendationContent) {
        recommendationContent.style.display = 'none';
        recommendationContent.classList.remove('visible');
    }
}

// Function to hide kit confirmation loading state
function hideKitConfirmationLoading() {
    const recommendationLoading = document.getElementById('recommendation-loading');
    const recommendationContent = document.getElementById('recommendation-content');
    
    // Hide loading, show content
    if (recommendationLoading) {
        recommendationLoading.style.display = 'none';
        // Reset loading text
        const loadingText = recommendationLoading.querySelector('p');
        if (loadingText) {
            loadingText.textContent = 'Generando recomendaciones de kits...';
        }
    }
    if (recommendationContent) {
        recommendationContent.style.display = 'block';
        setTimeout(() => {
            recommendationContent.classList.add('visible');
        }, 50);
    }
}

// Function to show final report
function showFinalReport() {
    console.log('Showing final report...');
    
    // Hide recommendation block
    if (recommendationBlock) {
        recommendationBlock.classList.remove('visible');
        setTimeout(() => {
            recommendationBlock.style.display = 'none';
        }, 500);
    }
    
    // Show final report block
    if (finalReportBlock) {
        finalReportBlock.style.display = 'block';
        setTimeout(() => {
            finalReportBlock.classList.add('visible');
        }, 100);
    }
    
    // Populate report data
    populateFinalReport();
    
    // Scroll to final report
    setTimeout(() => {
        if (finalReportBlock) {
            window.scrollTo({
                top: finalReportBlock.getBoundingClientRect().top + window.scrollY - 30,
                behavior: 'smooth'
            });
        }
    }, 800);
}

// Function to populate final report
function populateFinalReport() {
    // Set end time for workflow
    workflowEndTime = new Date();
    
    // Set report date
    const reportDate = document.getElementById('report-date');
    if (reportDate) {
        reportDate.textContent = new Date().toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Set AigentID
    const reportAigentId = document.getElementById('report-aigent-id');
    if (reportAigentId) {
        reportAigentId.textContent = currentAigentID || 'N/A';
    }
    
    // Set timestamp
    const reportTimestamp = document.getElementById('report-timestamp');
    if (reportTimestamp) {
        reportTimestamp.textContent = formatTimestamp(workflowEndTime);
    }
    
    // Set duration
    const reportDuration = document.getElementById('report-duration');
    if (reportDuration) {
        reportDuration.textContent = calculateTimeDuration(workflowStartTime, workflowEndTime);
    }
    
    // Set input data
    const reportCoordinates = document.getElementById('report-coordinates');
    if (reportCoordinates) {
        reportCoordinates.textContent = inputCoordinates;
    }
    
    const reportBandwidth = document.getElementById('report-bandwidth');
    if (reportBandwidth) {
        reportBandwidth.textContent = inputBandwidth;
    }
    
    // Populate SOP details
    populateSOPDetails();
    
    // Populate Kit details
    populateKitDetails();
}

// Function to populate SOP details in report
function populateSOPDetails() {
    const sopDetailsContainer = document.getElementById('report-sop-details');
    if (!sopDetailsContainer) return;
    if (!confirmedSOP || !confirmedSOP.data) {
        sopDetailsContainer.innerHTML = '<div class="no-data" style="color:#c00;text-align:center;">No SOP seleccionado o datos incompletos.</div>';
        console.error('No confirmed SOP or missing data for report.');
        return;
    }
    const sopData = confirmedSOP.data;
    const isSuccess = sopData.status === 'Clear' || sopData.status === 'clear';
    const chartId = `report-chart-${sopData.SOP.replace('-', '')}`;
    sopDetailsContainer.innerHTML = `
        <div class="card-header">
            <div class="card-title" style="color:#222;">${sopData.SOP} - ${sopData.Plaza}</div>
            <div class="status-badge ${isSuccess ? 'status-success' : 'status-blocked'}" style="color:#fff;">
                ${isSuccess ? '✓ Clear' : '✗ Blocked'}
            </div>
        </div>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label" style="color:#333;">Distance</div>
                <div class="info-value" style="color:#222;">${sopData.distance_km} km</div>
            </div>
            <div class="info-item">
                <div class="info-label" style="color:#333;">Coordinates</div>
                <div class="info-value" style="color:#222;">${sopData.coordinates || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label" style="color:#333;">Elevation</div>
                <div class="info-value" style="color:#222;">${sopData.elevation || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label" style="color:#333;">Status</div>
                <div class="info-value" style="color:#222;">${sopData.status || 'N/A'}</div>
            </div>
        </div>
        <div class="chart-container" style="height:220px; margin-top:1.5rem;">
            <div class="chart-title" style="color:#222;">Elevation Profile</div>
            <canvas id="${chartId}" style="max-width:100%;height:200px;"></canvas>
        </div>
    `;
    setTimeout(() => {
        if (sopData.results && sopData.results.length > 0 && sopData.lineOfSight) {
            createElevationChart(sopData, chartId);
        } else {
            const canvas = document.getElementById(chartId);
            if (canvas) canvas.parentElement.innerHTML += '<p class="no-data" style="color:#c00;text-align:center;">No elevation data available.</p>';
            console.warn('No elevation data for SOP chart.');
        }
    }, 100);
}

// Function to populate Kit details in report
function populateKitDetails() {
    const kitDetailsContainer = document.getElementById('report-kit-details');
    if (!kitDetailsContainer || !confirmedKit) return;
    
    kitDetailsContainer.innerHTML = `
        <h4>${confirmedKit.name}</h4>
        <div class="kit-details-grid">
            <div class="kit-detail-item">
                <span class="kit-detail-label">Radio</span>
                <span class="kit-detail-value">${confirmedKit.radio}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Antena</span>
                <span class="kit-detail-value">${confirmedKit.antenna}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Banda de Frecuencia</span>
                <span class="kit-detail-value">${confirmedKit.frequency_band}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Throughput Máximo</span>
                <span class="kit-detail-value">${confirmedKit.max_throughput}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Potencia de Transmisión</span>
                <span class="kit-detail-value">${confirmedKit.transmit_power}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Ganancia de Antena</span>
                <span class="kit-detail-value">${confirmedKit.antenna_gain}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Margen de Enlace</span>
                <span class="kit-detail-value highlight">${confirmedKit.link_margin}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Costo</span>
                <span class="kit-detail-value highlight">${confirmedKit.cost}</span>
            </div>
        </div>
    `;
}

// Function to handle kit confirmation
async function handleKitConfirmation() {
    if (!window.selectedKitData) {
        showStatusMessage('No kit selected', 'error');
        return;
    }
    
    const confirmKitButton = document.getElementById('confirm-kit-selection-button');
    if (confirmKitButton) {
        confirmKitButton.disabled = true;
        confirmKitButton.textContent = 'Enviando...';
    }
    
    // Show loading animation immediately
    showKitConfirmationLoading();
    
    try {
        showStatusMessage('Sending kit selection to server...', 'info');
        
        // Prepare the request data
        const requestData = {
            selectedKit: window.selectedKitData,
            AigentID: currentAigentID
        };
        
        // Send POST request to kit selection webhook
        const response = await fetch(n8nKitSelectionWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with error: ${response.status} ${response.statusText}`);
        }
        
        const responseData = await response.json();
        
        console.log('Kit selection sent successfully:', responseData);
        showStatusMessage(`Kit selection confirmed: ${window.selectedKitData.name}`, 'success');
        
        // Store confirmed kit for final report
        confirmedKit = window.selectedKitData;
        
        // Hide loading and show success state
        hideKitConfirmationLoading();
        
        // Reset button
        if (confirmKitButton) {
            confirmKitButton.disabled = false;
            confirmKitButton.textContent = 'Confirmar Selección de Kit';
        }
        
        // Show final report
        showFinalReport();
        
    } catch (error) {
        console.error('Error sending kit selection:', error);
        showStatusMessage(`Error sending kit selection: ${error.message}`, 'error');
        
        // Hide loading on error
        hideKitConfirmationLoading();
        
        // Reset button on error
        if (confirmKitButton) {
            confirmKitButton.disabled = false;
            confirmKitButton.textContent = 'Confirmar Selección de Kit';
        }
    }
}

// Function to populate the recommendation block with data
function populateRecommendationBlock(data) {
    console.log('Populating recommendation block with data:', data);
    
    const kitDropdown = document.getElementById('kit-dropdown');
    const kitsGrid = document.querySelector('.kits-grid');
    const highReliabilityContent = document.querySelector('.recommendation-card.high-reliability .recommendation-content');
    const bestValueContent = document.querySelector('.recommendation-card.best-value .recommendation-content');
    
    // Clear existing content
    if (kitDropdown) {
        kitDropdown.innerHTML = '<option value="">Seleccione un kit...</option>';
    }
    if (kitsGrid) {
        kitsGrid.innerHTML = '';
    }
    if (highReliabilityContent) {
        highReliabilityContent.innerHTML = '';
    }
    if (bestValueContent) {
        bestValueContent.innerHTML = '';
    }
    
    // Validate data structure
    if (!data) {
        console.error('No data provided to populateRecommendationBlock');
        return;
    }
    
    // Populate dropdown with viable kits
    if (data.viable_kits && Array.isArray(data.viable_kits)) {
        console.log(`Found ${data.viable_kits.length} viable kits`);
        data.viable_kits.forEach((kit, index) => {
            if (kitDropdown && kit.name) {
                const option = document.createElement('option');
                option.value = kit.name;
                option.textContent = kit.name;
                kitDropdown.appendChild(option);
            }
        });
    } else {
        console.warn('No viable_kits found in data or invalid format');
    }
    
    // Create kit cards
    if (data.viable_kits && Array.isArray(data.viable_kits)) {
        data.viable_kits.forEach((kit, index) => {
            if (kitsGrid) {
                const kitCard = createKitCard(kit);
                kitsGrid.appendChild(kitCard);
            }
        });
    }
    
    // Populate recommendation cards
    // Robust: show details if kit found, else fallback to name or message
    if (data.high_reliability_recommendation && highReliabilityContent) {
        let text = '';
        if (data.viable_kits && Array.isArray(data.viable_kits)) {
            const kit = data.viable_kits.find(k => k.name === data.high_reliability_recommendation);
            if (kit) {
                text = `<strong>${kit.name}</strong> is recommended for high reliability with a link margin of <strong>${kit.link_margin}</strong> and antenna gain of <strong>${kit.antenna_gain}</strong>.`;
            }
        }
        if (!text) text = typeof data.high_reliability_recommendation === 'string' ? data.high_reliability_recommendation : 'No recommendation.';
        highReliabilityContent.innerHTML = text;
    } else if (highReliabilityContent) {
        highReliabilityContent.textContent = 'No high reliability recommendation.';
    }
    if (data.best_value_recommendation && bestValueContent) {
        let text = '';
        if (data.viable_kits && Array.isArray(data.viable_kits)) {
            const kit = data.viable_kits.find(k => k.name === data.best_value_recommendation);
            if (kit) {
                text = `<strong>${kit.name}</strong> is recommended as the best value option with a link margin of <strong>${kit.link_margin}</strong> and cost of <strong>${kit.cost}</strong>.`;
            }
        }
        if (!text) text = typeof data.best_value_recommendation === 'string' ? data.best_value_recommendation : 'No recommendation.';
        bestValueContent.innerHTML = text;
    } else if (bestValueContent) {
        bestValueContent.textContent = 'No best value recommendation.';
    }
}

// Function to create a kit card
function createKitCard(kit) {
    const card = document.createElement('div');
    card.className = 'kit-card';
    
    // Helper function to safely get property values
    const getValue = (obj, key, defaultValue = 'N/A') => {
        return obj && obj[key] ? obj[key] : defaultValue;
    };
    
    card.innerHTML = `
        <h4>${getValue(kit, 'name', 'Kit Sin Nombre')}</h4>
        <div class="kit-details">
            <div class="kit-detail-item">
                <span class="kit-detail-label">Radio</span>
                <span class="kit-detail-value">${getValue(kit, 'radio')}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Antena</span>
                <span class="kit-detail-value">${getValue(kit, 'antenna')}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Banda de Frecuencia</span>
                <span class="kit-detail-value">${getValue(kit, 'frequency_band')}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Throughput Máximo</span>
                <span class="kit-detail-value">${getValue(kit, 'max_throughput')}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Potencia de Transmisión</span>
                <span class="kit-detail-value">${getValue(kit, 'transmit_power')}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Ganancia de Antena</span>
                <span class="kit-detail-value">${getValue(kit, 'antenna_gain')}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Margen de Enlace</span>
                <span class="kit-detail-value highlight">${getValue(kit, 'link_margin')}</span>
            </div>
            <div class="kit-detail-item">
                <span class="kit-detail-label">Costo</span>
                <span class="kit-detail-value highlight">${getValue(kit, 'cost')}</span>
            </div>
        </div>
    `;
    
    return card;
}

// Add event listener for confirm selection button
const confirmSelectionButton = document.getElementById('confirm-selection-button');
if (confirmSelectionButton) {
    confirmSelectionButton.addEventListener('click', handleConfirmSelection);
}

// Add event listener for PDF download button
const downloadPdfButton = document.getElementById('download-pdf-button');
if (downloadPdfButton) {
    downloadPdfButton.addEventListener('click', downloadPDF);
}

// Vercel API Proxy URLs
const n8nWebhookUrl = '/api/get-coordinates';

// Vercel API Proxy Selection URL
const n8nSelectionWebhookUrl = '/api/get-SOP-selection';

// Vercel API Proxy Kit Selection URL
const n8nKitSelectionWebhookUrl = '/api/get-KIT-selection';

// Sample data for UX validation
const sampleData = {
    trueResults: [
        {
            row_number: 5,
            SOP: "SOP-00008",
            Plaza: "Monterrey",
            Coordenadas: "25.654627,-100.326208",
            Terreno: 3,
            "Altura (mts)": 21,
            distance_km: 0.775,
            user_coordinates: "25.6479154, -100.3282983",
            lineOfSight: {
                hasLineOfSight: true,
                totalDistanceKm: 0.7751501078144118,
                obstructionCount: 0,
                summary: {
                    canSee: true,
                    recommendation: "Line of sight confirmed - connection possible"
                }
            }
        },
        {
            row_number: 2,
            SOP: "SOP-00014",
            Plaza: "Monterrey",
            Coordenadas: "25.661905,-100.403204",
            Terreno: 9,
            "Altura (mts)": 24,
            distance_km: 7.667,
            user_coordinates: "25.6479154, -100.3282983",
            lineOfSight: {
                hasLineOfSight: true,
                totalDistanceKm: 7.667485754323918,
                obstructionCount: 0,
                summary: {
                    canSee: true,
                    recommendation: "Line of sight confirmed - connection possible"
                }
            }
        }
    ],
    falseResults: [
        {
            row_number: 4,
            SOP: "SOP-00022",
            Plaza: "Monterrey",
            Coordenadas: "25.664495,-100.353095",
            Terreno: 60,
            "Altura (mts)": 3,
            distance_km: 3.095,
            user_coordinates: "25.6479154, -100.3282983",
            lineOfSight: {
                hasLineOfSight: false,
                totalDistanceKm: 3.0945225939266163,
                obstructionCount: 6,
                maxObstruction: 7.6369235041703405,
                summary: {
                    canSee: false,
                    recommendation: "Antenna height at target should be increased by at least 9m for clear line of sight"
                },
                visualizationData: {
                    obstructionPercentages: [
                        { atDistance: "1.61km", blockage: "1.00m", percentOfPath: "52.0%" },
                        { atDistance: "1.73km", blockage: "3.39m", percentOfPath: "56.0%" },
                        { atDistance: "1.86km", blockage: "5.17m", percentOfPath: "60.0%" },
                        { atDistance: "1.98km", blockage: "7.64m", percentOfPath: "64.0%" },
                        { atDistance: "2.10km", blockage: "3.68m", percentOfPath: "68.0%" },
                        { atDistance: "2.23km", blockage: "2.12m", percentOfPath: "72.0%" }
                    ]
                }
            }
        }
    ]
};

// Trigger smooth opening animation for client coordinates form block
window.addEventListener('load', () => {
    // Add loading animation for body
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
    
    // Trigger animation for client coordinates form block
    if (clientCoordinatesFormBlock) {
        setTimeout(() => {
            clientCoordinatesFormBlock.classList.add('animate-in');
        }, 300); // Small delay for better visual effect
    }
});

function showStatusMessage(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = '';
    statusMessage.style.display = 'block';
    statusMessage.classList.add('status-' + type);
}
function hideStatusMessage() {
    statusMessage.textContent = '';
    statusMessage.className = '';
    statusMessage.style.display = 'none';
}

function scrollToResults() {
    setTimeout(() => {
        const block = document.getElementById('first-results-block');
        if (block && block.style.display !== 'none') {
            // Use window.scrollTo with block's offsetTop for reliability
            window.scrollTo({
                top: block.getBoundingClientRect().top + window.scrollY - 30,
                behavior: 'smooth'
            });
        }
    }, 200);
}

function addCloseExampleButton() {
    let closeBtn = document.getElementById('close-example-btn');
    if (!closeBtn) {
        closeBtn = document.createElement('button');
        closeBtn.id = 'close-example-btn';
        closeBtn.textContent = 'Cerrar Ejemplo';
        closeBtn.style.cssText = 'display:block;margin:20px auto 0 auto;background:linear-gradient(135deg,#f44336,#d32f2f);color:white;border:none;border-radius:25px;font-size:1.1rem;font-weight:bold;padding:12px 28px;cursor:pointer;box-shadow:0 5px 15px rgba(0,0,0,0.12);transition:all 0.2s;';
        closeBtn.onmouseover = function() { closeBtn.style.transform = 'translateY(-2px)'; closeBtn.style.boxShadow = '0 8px 25px rgba(0,0,0,0.18)'; };
        closeBtn.onmouseout = function() { closeBtn.style.transform = ''; closeBtn.style.boxShadow = '0 5px 15px rgba(0,0,0,0.12)'; };
        closeBtn.onclick = function() {
            // Clear SOP data when closing example
            allSopData = {};
            
            firstResultsBlock.classList.remove('visible');
            setTimeout(() => {
                firstResultsBlock.style.display = 'none';
                firstResultsBlock.querySelector('.results-container').innerHTML = '';
                closeBtn.remove();
                clientCoordinatesFormBlock.classList.remove('minimized');
                hideStatusMessage();
            }, 500);
            
            // Hide recommendation block if present
            if (recommendationBlock) {
                recommendationBlock.classList.remove('visible');
                setTimeout(() => {
                    recommendationBlock.style.display = 'none';
                }, 500);
            }
        };
        firstResultsBlock.parentNode.insertBefore(closeBtn, firstResultsBlock.nextSibling);
    }
}

if (loadExampleButton) {
    loadExampleButton.addEventListener('click', () => {
        // Clear previous SOP data and set sample AigentID
        allSopData = {};
        currentAigentID = 'AIG-SAMPLE-20241201-000000-XXXXX';
        updateAigentIDDisplay(currentAigentID);
        
        hideStatusMessage();
        // Do NOT minimize the form block
        // Show results below the form
        loadingBlock.style.display = 'none';
        loadingBlock.classList.remove('visible');
        firstResultsBlock.style.display = 'block';
        setTimeout(() => {
            firstResultsBlock.classList.add('visible');
        }, 50);
        populateResultsBlock(sampleData);
        addCloseExampleButton();
        scrollToResults();
    });
}

// Confirm Address Button Click Handler
if (confirmAddressButton) {
    confirmAddressButton.addEventListener('click', async () => {
        // Clear previous SOP data and reset AigentID for new workflow
        allSopData = {};
        currentAigentID = null;
        updateAigentIDDisplay(null);
        
        // Start workflow timer
        workflowStartTime = new Date();
        workflowEndTime = null;
        
        // Remove example close button and hide results if present
        const closeBtn = document.getElementById('close-example-btn');
        if (closeBtn) closeBtn.remove();
        firstResultsBlock.classList.remove('visible');
        setTimeout(() => {
            firstResultsBlock.style.display = 'none';
            firstResultsBlock.querySelector('.results-container').innerHTML = '';
        }, 400);
        
        // Hide recommendation block if present
        if (recommendationBlock) {
            recommendationBlock.classList.remove('visible');
            setTimeout(() => {
                recommendationBlock.style.display = 'none';
            }, 400);
        }
        // Get the values from the inputs
        const clientAddressInput = document.querySelector('#client-address-input');
        const clientAddress = clientAddressInput.value.trim();
        const bandwidth = bandwidthInput.value.trim();
        
        // Validate inputs
        if (!clientAddress) {
            showStatusMessage('Por favor, introduzca una dirección o coordenadas.', 'error');
            return;
        }
        
        if (!bandwidth) {
            showStatusMessage('Por favor, introduzca el ancho de banda requerido.', 'error');
            return;
        }
        
        // Store the bandwidth value
        storedBandwidth = bandwidth;
        inputBandwidth = bandwidth;
        inputCoordinates = clientAddress;
        console.log('Bandwidth stored:', storedBandwidth);
        hideStatusMessage();
        // Prepare the request data
        const requestData = {
            clientAddress: clientAddress
        };
        
        try {
            // Show loading animation immediately
            showCoordinateLoading();
            showStatusMessage('Conectando con el servidor...', 'info');
            showStatusMessage('Enviando datos al servidor...', 'info');
            // Send POST request to n8n webhook
            const response = await fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            if (!response.ok) {
                throw new Error('El servidor respondió con un error (' + response.status + ')');
            }
            showStatusMessage('Procesando respuesta del servidor...', 'info');
            const responseData = await response.json();
            
            // Validate and extract response data
            const validatedData = validateAndExtractResponseData(responseData);
            if (!validatedData) {
                throw new Error('La respuesta del servidor no tiene el formato esperado.');
            }
            
            // Store AigentID from response
            if (validatedData.aigentID) {
                currentAigentID = validatedData.aigentID;
                console.log('Received AigentID:', currentAigentID);
                updateAigentIDDisplay(currentAigentID);
            } else {
                console.warn('No AigentID received in response');
            }
            
            const results = validatedData.results;
            
            // Final validation of results structure
            if (!results.trueResults && !results.falseResults) {
                throw new Error('Los resultados no contienen datos válidos de análisis.');
            }

            // Hide loading animation
            hideCoordinateLoading();
            // Show and populate first results block
            setTimeout(() => {
                populateResultsBlock(results); // Use the corrected 'results' object
                firstResultsBlock.style.display = 'block';
                setTimeout(() => {
                    firstResultsBlock.classList.add('visible');
                }, 50);
                showStatusMessage(`¡Análisis completado! (ID: ${currentAigentID || 'N/A'})`, 'success');
                scrollToResults();
            }, 700);
        } catch (error) {
            // Hide loading animation on error
            hideCoordinateLoading();
            showStatusMessage('Error: ' + (error.message || error), 'error');
        } finally {
            // Always trigger the smooth closing of the form block
            clientCoordinatesFormBlock.classList.add('minimized');
            // Wait for the minimize animation to complete, then show edit button
            setTimeout(() => {
                // Create and append the edit address button
                const editButton = document.createElement('a');
                editButton.href = '#';
                editButton.className = 'reopen-form-button';
                editButton.textContent = 'Editar dirección';
                // Add click handler for the edit button
                editButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    clientCoordinatesFormBlock.classList.remove('minimized');
                    editButton.classList.remove('visible');
                    setTimeout(() => {
                        if (editButton.parentNode) {
                            editButton.remove();
                        }
                    }, 300);
                });
                // Append to app container
                appContainer.appendChild(editButton);
                // Show the edit button with animation
                setTimeout(() => {
                    editButton.classList.add('visible');
                }, 50);
            }, 600);
        }
    });
}

// Function to populate results block with dynamic content (card-based, sectioned)
function populateResultsBlock(responseData) {
    const resultsContainer = firstResultsBlock.querySelector('.results-container');
    resultsContainer.innerHTML = '';

    // Add AigentID display at the top of results
    if (currentAigentID) {
        const aigentIdHeader = document.createElement('div');
        aigentIdHeader.className = 'aigent-id-header';
        aigentIdHeader.innerHTML = `
            <div class="aigent-id-badge">
                <strong>Workflow ID:</strong> ${currentAigentID}
            </div>
        `;
        resultsContainer.appendChild(aigentIdHeader);
    }

    // Store complete data for each SOP
    if (responseData.trueResults) {
        responseData.trueResults.forEach(result => {
            allSopData[result.SOP] = result;
        });
    }
    if (responseData.falseResults) {
        responseData.falseResults.forEach(result => {
            allSopData[result.SOP] = result;
        });
    }
    
    // Debug: Log stored SOP data (can be removed in production)
    console.log('Stored SOP data:', allSopData);

    // Helper to create a card for each result
    function createCard(result, isSuccess) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.sop = result.SOP;

        const statusClass = isSuccess ? 'status-success' : 'status-blocked';
        const statusText = isSuccess ? 'Clear' : 'Blocked';
        const statusIcon = isSuccess ? '✓' : '✗';

        // Card header
        card.innerHTML = `
            <button class="card-select-button">Select</button>
            <div class="card-header">
                <div class="card-title">${result.SOP} - ${result.Plaza}</div>
                <div class="status-badge ${statusClass}">${statusIcon} ${statusText}</div>
            </div>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Distance</div>
                    <div class="info-value">${result.distance_km} km</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Obstructions</div>
                    <div class="info-value">${result.lineOfSight?.obstructionCount || 0}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Target Coords</div>
                    <div class="info-value coordinates">${result.Coordenadas}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Antenna Height</div>
                    <div class="info-value">${result['Altura (mts)']} m</div>
                </div>
            </div>
            ${!isSuccess && result.lineOfSight?.visualizationData ? `
                <div class="obstruction-details">
                    <strong>Obstruction Details:</strong>
                    ${result.lineOfSight.visualizationData.obstructionPercentages.map(obs => `
                        <div class="obstruction-item">
                            <span>At ${obs.atDistance} (${obs.percentOfPath})</span>
                            <span><strong>${obs.blockage}</strong></span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            <div class="recommendation">
                <strong>Recommendation:</strong> ${result.lineOfSight?.summary?.recommendation || 'Analysis completed'}
            </div>
            <div class="chart-container">
                <div class="chart-title">Elevation Profile</div>
                <canvas id="chart-${result.SOP.replace('-', '')}"></canvas>
            </div>
        `;

        // Add click event listener to the card
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking on the select button
            if (e.target.classList.contains('card-select-button')) {
                return;
            }
            selectCard(card);
        });

        // Add click event listener to the select button
        const selectButton = card.querySelector('.card-select-button');
        selectButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click event
            selectCard(card);
        });

        // Add chart after the card is added to DOM
        setTimeout(() => {
            createElevationChart(result, `chart-${result.SOP.replace('-', '')}`);
        }, 100);

        return card;
    }

    // Helper to create the elevation chart (dummy data for now)
    function createElevationChart(result, canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !result.results || result.results.length === 0) {
            if (canvas) canvas.parentElement.innerHTML += '<p class="no-data" style="color:#666;text-align:center;">No elevation data available.</p>';
            return;
        }

        const ctx = canvas.getContext('2d');
        const hasObstructions = !result.lineOfSight?.hasLineOfSight;
        const totalDistance = result.lineOfSight.totalDistanceKm;

        // Use real elevation data from the webhook response
        const labels = result.results.map((_, index) => {
            const distancePoint = (totalDistance * index) / (result.results.length - 1);
            return distancePoint.toFixed(2);
        });
        const elevationData = result.results.map(p => p.elevation);

        // Generate the straight line of sight using adjusted start and end points
        const startElevation = result.lineOfSight.firstPoint.adjustedElevation;
        const endElevation = result.lineOfSight.lastPoint.adjustedElevation;
        const sightLineData = result.results.map((_, index) => {
             return startElevation - ((startElevation - endElevation) * index / (result.results.length - 1));
        });

        // Destroy existing chart to prevent rendering issues on updates
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) {
            existingChart.destroy();
        }

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Terrain Elevation',
                    data: elevationData,
                    borderColor: hasObstructions ? '#f44336' : '#4CAF50',
                    backgroundColor: hasObstructions ? 'rgba(244, 67, 54, 0.1)' : 'rgba(76, 175, 80, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 1
                }, {
                    label: 'Line of Sight',
                    data: sightLineData,
                    borderColor: '#2196F3',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Distance (km)' } },
                    y: { title: { display: true, text: 'Elevation (m)' } }
                },
                plugins: { legend: { position: 'top' } }
            }
        });
    }

    // Function to handle card selection
    function selectCard(selectedCard) {
        // Remove selection from all other cards
        const allCards = document.querySelectorAll('.card');
        allCards.forEach(card => {
            card.classList.remove('is-selected');
        });
        
        // Add selection to the clicked card
        selectedCard.classList.add('is-selected');
        
        // Enable the confirm selection button
        const confirmButton = document.getElementById('confirm-selection-button');
        if (confirmButton) {
            confirmButton.classList.add('enabled');
        }
    }

    // Clear and add sections
    resultsContainer.innerHTML = '';

    // Reset confirm selection button state
    const confirmButton = document.getElementById('confirm-selection-button');
    if (confirmButton) {
        confirmButton.classList.remove('enabled');
    }

    // Success section
    if (responseData.trueResults && responseData.trueResults.length > 0) {
        const successSection = document.createElement('div');
        successSection.innerHTML = '<h2 class="section-title">✅ Successful Connections</h2>';
        const successGrid = document.createElement('div');
        successGrid.className = 'results-container';
        responseData.trueResults.forEach(result => {
            successGrid.appendChild(createCard(result, true));
        });
        successSection.appendChild(successGrid);
        resultsContainer.appendChild(successSection);
    }

    // Blocked section
    if (responseData.falseResults && responseData.falseResults.length > 0) {
        const blockedSection = document.createElement('div');
        blockedSection.innerHTML = '<h2 class="section-title">❌ Blocked Connections</h2>';
        const blockedGrid = document.createElement('div');
        blockedGrid.className = 'results-container';
        responseData.falseResults.forEach(result => {
            blockedGrid.appendChild(createCard(result, false));
        });
        blockedSection.appendChild(blockedGrid);
        resultsContainer.appendChild(blockedSection);
    }
}

// Mobile Navigation Toggle
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Smooth scrolling for navigation links
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        
        if (targetSection) {
            const offsetTop = targetSection.offsetTop - 80; // Account for fixed navbar
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Navbar background on scroll
window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        navbar.style.background = 'rgba(0, 0, 0, 0.98)';
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.3)';
    } else {
        navbar.style.background = 'rgba(0, 0, 0, 0.95)';
        navbar.style.boxShadow = 'none';
    }
});

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe sections for animation
sections.forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(30px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(section);
});

// CTA Button click handler
ctaButton.addEventListener('click', () => {
    const aboutSection = document.querySelector('#about');
    if (aboutSection) {
        const offsetTop = aboutSection.offsetTop - 80;
        window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
        });
    }
});

// Contact form submission
contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(contactForm);
    const name = formData.get('name');
    const email = formData.get('email');
    const message = formData.get('message');
    
    // Simple validation
    if (!name || !email || !message) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    // Simulate form submission
    showNotification('Message sent successfully!', 'success');
    contactForm.reset();
});

// Email validation function
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 4px;
        color: #ffffff;
        font-weight: 500;
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Set background color based on type
    if (type === 'success') {
        notification.style.background = '#4CAF50';
    } else if (type === 'error') {
        notification.style.background = '#f44336';
    } else {
        notification.style.background = '#2196F3';
    }
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// Parallax effect for hero section
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    
    if (hero) {
        const rate = scrolled * -0.5;
        hero.style.transform = `translateY(${rate}px)`;
    }
});

// Typing effect for hero title
function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.textContent = '';
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// Initialize typing effect when page loads
window.addEventListener('load', () => {
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        const originalText = heroTitle.textContent;
        typeWriter(heroTitle, originalText, 80);
    }
});

// Work item hover effects
const workItems = document.querySelectorAll('.work-item');
workItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
        item.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    item.addEventListener('mouseleave', () => {
        item.style.transform = 'translateY(0) scale(1)';
    });
});

// Stats counter animation
function animateCounters() {
    const stats = document.querySelectorAll('.stat h3');
    
    stats.forEach(stat => {
        const target = parseInt(stat.textContent);
        const increment = target / 50;
        let current = 0;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            stat.textContent = Math.floor(current) + (stat.textContent.includes('+') ? '+' : '') + 
                             (stat.textContent.includes('%') ? '%' : '');
        }, 30);
    });
}

// Trigger counter animation when about section is visible
const aboutSection = document.querySelector('#about');
if (aboutSection) {
    const aboutObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounters();
                aboutObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    aboutObserver.observe(aboutSection);
}

// Keyboard navigation support
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close mobile menu
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    }
});

// Performance optimization: Throttle scroll events
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Apply throttling to scroll events
window.addEventListener('scroll', throttle(() => {
    // Navbar scroll effect
    if (window.scrollY > 100) {
        navbar.style.background = 'rgba(0, 0, 0, 0.98)';
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.3)';
    } else {
        navbar.style.background = 'rgba(0, 0, 0, 0.95)';
        navbar.style.boxShadow = 'none';
    }
    
    // Parallax effect
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    if (hero) {
        const rate = scrolled * -0.5;
        hero.style.transform = `translateY(${rate}px)`;
    }
}, 16)); // ~60fps

// Test function for kit recommendations (Option 2)
function testKitRecommendations() {
    console.log('Testing kit recommendations with loading animation...');
    
    const testData = {
        output: {
            viable_kits: [
                {
                    name: "KIT 1",
                    radio: "Mimosa C5x",
                    antenna: "Antena Mimosa N5X25",
                    frequency_band: "4.9 - 6.4 GHz",
                    max_throughput: "700 Mbps",
                    transmit_power: "27 dBm",
                    antenna_gain: "25 dBi",
                    link_margin: "21.36 dB",
                    cost: "691 USD"
                },
                {
                    name: "KIT 2",
                    radio: "Mimosa C5c",
                    antenna: "Antena 30 dB ubiquiti AF-5G30-S45",
                    frequency_band: "4.9 - 5.9 GHz",
                    max_throughput: "700 Mbps",
                    transmit_power: "27 dBm",
                    antenna_gain: "30 dBi",
                    link_margin: "27.06 dB",
                    cost: "1241 USD"
                },
                {
                    name: "KIT 3 - opción 1",
                    radio: "Cambium 4600C C060940C121C",
                    antenna: "Antena Txpro 30 dbi TXP7GD30",
                    frequency_band: "5.7 - 7.1 GHz",
                    max_throughput: "2000 Mbps",
                    transmit_power: "30 dBm",
                    antenna_gain: "31 dBi",
                    link_margin: "28.46 dB",
                    cost: "1940 USD"
                },
                {
                    name: "KIT 3 - opción 2",
                    radio: "Cambium 4600C C060940C121C",
                    antenna: "Antena 32dbi NP6 (incluye pigtails)",
                    frequency_band: "5.9 - 7.2 GHz",
                    max_throughput: "2000 Mbps",
                    transmit_power: "30 dBm",
                    antenna_gain: "32 dBi",
                    link_margin: "29.33 dB",
                    cost: "2230 USD"
                }
            ],
            high_reliability_recommendation: "KIT 3 - opción 2",
            best_value_recommendation: "KIT 1",
            aigent_id: "AIG-20250712-200313-9RQS6"
        }
    };
    
    // Call the display function directly
    displayKitRecommendations(testData.output);
}

// Test function for final report
function testFinalReport() {
    console.log('Testing final report...');
    
    // Set test data
    currentAigentID = "AIG-20250712-200313-9RQS6";
    inputCoordinates = "Calle Principal 123, Ciudad de México";
    inputBandwidth = "100 Mbps";
    
    // Set test time tracking
    workflowStartTime = new Date(Date.now() - 300000); // 5 minutes ago
    workflowEndTime = new Date();
    
    confirmedSOP = {
        id: "SOP-00008",
        data: {
            SOP: "SOP-00008",
            Plaza: "Plaza Central",
            distance_km: "2.5",
            coordinates: "19.4326° N, 99.1332° W",
            elevation: "2,240 m",
            status: "Clear"
        }
    };
    
    confirmedKit = {
        name: "KIT 1",
        radio: "Mimosa C5x",
        antenna: "Antena Mimosa N5X25",
        frequency_band: "4.9 - 6.4 GHz",
        max_throughput: "700 Mbps",
        transmit_power: "27 dBm",
        antenna_gain: "25 dBi",
        link_margin: "21.36 dB",
        cost: "691 USD"
    };
    
    // Show final report
    showFinalReport();
}

// Function to download PDF report
async function downloadPDF() {
    console.log('Generating PDF report...');
    
    const downloadButton = document.getElementById('download-pdf-button');
    if (downloadButton) {
        downloadButton.disabled = true;
        downloadButton.innerHTML = '<span class="download-icon">⏳</span> Generando PDF...';
    }
    
    try {
        // Create a clone of the report container for PDF generation
        const reportContainer = document.querySelector('.final-report-container');
        const pdfContainer = reportContainer.cloneNode(true);
        
        // Remove all canvas and re-render static images for charts
        const canvases = reportContainer.querySelectorAll('canvas');
        const pdfCanvases = pdfContainer.querySelectorAll('canvas');
        canvases.forEach((canvas, idx) => {
            const img = document.createElement('img');
            img.src = canvas.toDataURL('image/png');
            img.style.display = 'block';
            img.style.maxWidth = '100%';
            img.style.height = '200px';
            pdfCanvases[idx].replaceWith(img);
        });
        
        // Universal override for all text in PDF
        pdfContainer.querySelectorAll('*').forEach(el => {
            if (el.nodeType === 1) {
                el.style.color = '#222';
            }
        });

        // Add PDF-specific styles
        pdfContainer.style.background = 'white';
        pdfContainer.style.color = '#222';
        pdfContainer.style.padding = '24px';
        pdfContainer.style.maxWidth = '800px';
        pdfContainer.style.margin = '0 auto';
        pdfContainer.style.fontFamily = 'Arial, sans-serif';
        pdfContainer.style.boxSizing = 'border-box';
        pdfContainer.style.width = '100%';
        
        // Update colors for PDF
        const sections = pdfContainer.querySelectorAll('.report-section');
        sections.forEach(section => {
            section.style.background = '#f8f9fa';
            section.style.border = '1px solid #dee2e6';
            section.style.color = '#222';
            section.style.pageBreakInside = 'avoid';
        });
        
        // Update headers for PDF
        const headers = pdfContainer.querySelectorAll('h3, h4');
        headers.forEach(header => {
            header.style.color = '#2c5aa0';
        });
        
        // Update SOP details for PDF
        const sopDetails = pdfContainer.querySelector('.sop-details');
        if (sopDetails) {
            sopDetails.style.background = 'white';
            sopDetails.style.border = '1px solid #dee2e6';
            sopDetails.style.color = '#222';
            sopDetails.style.pageBreakInside = 'avoid';
        }
        
        // Update kit details for PDF
        const kitDetails = pdfContainer.querySelector('.kit-details');
        if (kitDetails) {
            kitDetails.style.background = '#f8f9fa';
            kitDetails.style.border = '1px solid #dee2e6';
            kitDetails.style.color = '#222';
            kitDetails.style.pageBreakInside = 'avoid';
        }
        
        // Update input values for PDF
        const inputValues = pdfContainer.querySelectorAll('.input-value');
        inputValues.forEach(input => {
            input.style.background = 'white';
            input.style.border = '1px solid #dee2e6';
            input.style.color = '#222';
        });
        
        // Update report meta for PDF
        const reportMeta = pdfContainer.querySelector('.report-meta');
        if (reportMeta) {
            reportMeta.style.background = '#f8f9fa';
            reportMeta.style.border = '1px solid #dee2e6';
            reportMeta.style.color = '#222';
            reportMeta.style.padding = '1rem';
            reportMeta.style.borderRadius = '4px';
            reportMeta.style.pageBreakInside = 'avoid';
        }
        
        // Update timestamp and duration for PDF
        const timestampSpans = pdfContainer.querySelectorAll('.report-timestamp span, .report-duration span');
        timestampSpans.forEach(span => {
            span.style.color = '#222';
        });
        
        // Highlight duration in PDF
        const durationSpan = pdfContainer.querySelector('.report-duration span');
        if (durationSpan) {
            durationSpan.style.color = '#28a745';
            durationSpan.style.fontWeight = 'bold';
        }
        
        // Configure PDF options
        const opt = {
            margin: [5, 5, 5, 5],
            filename: `Agente_Geografico_Report_${currentAigentID || 'N/A'}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                scrollY: 0,
                windowWidth: 800,
                windowHeight: 1120
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait' 
            },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        
        // Generate and download PDF
        await html2pdf().set(opt).from(pdfContainer).toPdf().get('pdf').then(pdf => {
            // Scale to fit one page
            const pageCount = pdf.internal.getNumberOfPages();
            if (pageCount > 1) {
                // Optionally, warn or auto-scale
                // For now, just fit to one page by scaling
                pdf.setPage(1);
                pdf.internal.scaleFactor = 1.1;
            }
        }).save();
        
        console.log('PDF generated successfully');
        showStatusMessage('PDF generado y descargado exitosamente', 'success');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showStatusMessage('Error al generar el PDF: ' + error.message, 'error');
    } finally {
        // Reset download button
        if (downloadButton) {
            downloadButton.disabled = false;
            downloadButton.innerHTML = '<span class="download-icon">📄</span> Descargar Reporte PDF';
        }
    }
}

// Make test functions available globally
window.testKitRecommendations = testKitRecommendations;
window.testFinalReport = testFinalReport; 