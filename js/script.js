// Disable browser scroll restoration immediately
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// Force scroll to top on page load
window.scrollTo(0, 0);

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
const bandwidthInput = document.querySelector('#bandwidth-input');
const loadingBlock = document.querySelector('#loading-block');
const firstResultsBlock = document.querySelector('#first-results-block');
const statusMessage = document.getElementById('status-message');

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

// Helper function to make fetch requests with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 60000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Start progress indicator for long requests
    let progressInterval;
    if (timeoutMs > 10000) { // Only show progress for requests longer than 10 seconds
        let elapsed = 0;
        progressInterval = setInterval(() => {
            elapsed += 2;
            const progress = Math.min((elapsed / (timeoutMs / 1000)) * 100, 95); // Cap at 95% to show it's still working
            showStatusMessage(`Procesando... (${Math.round(progress)}%)`, 'info', 'recommendations');
        }, 2000); // Update every 2 seconds
    }
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`);
        }
        throw error;
    }
}

// Global function to create elevation charts (moved from populateResultsBlock)
function createElevationChart(result, canvasId) {
    console.log('createElevationChart called with:', { result, canvasId });
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error('Canvas element not found for ID:', canvasId);
        return;
    }
    
    if (!result.results || result.results.length === 0) {
        console.warn('No results data available for chart:', result);
        canvas.parentElement.innerHTML += '<p class="no-data" style="color:#666;text-align:center;">No elevation data available.</p>';
        return;
    }

    console.log('Creating chart with data:', {
        resultsLength: result.results.length,
        lineOfSight: result.lineOfSight,
        totalDistance: result.lineOfSight?.totalDistanceKm
    });

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

    console.log('Chart data prepared:', {
        labelsCount: labels.length,
        elevationDataCount: elevationData.length,
        sightLineDataCount: sightLineData.length,
        startElevation,
        endElevation,
        hasObstructions
    });

    // Destroy existing chart to prevent rendering issues on updates
    const existingChart = Chart.getChart(canvasId);
    if (existingChart) {
        console.log('Destroying existing chart for ID:', canvasId);
        existingChart.destroy();
    }

    try {
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
        console.log('Chart created successfully for ID:', canvasId);
    } catch (error) {
        console.error('Error creating chart:', error);
        canvas.parentElement.innerHTML += '<p class="no-data" style="color:#c00;text-align:center;">Error creating chart: ' + error.message + '</p>';
    }
}

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

// Function to extract and validate kit recommendation data from various response formats
function extractKitRecommendationData(responseData) {
    console.log('Extracting kit recommendation data from:', responseData);
    
    let recommendationData = null;
    let errorMessage = null;
    
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
    
    // If we found recommendation data, check for errors
    if (recommendationData) {
        // Check for error_code and error_explanation
        if (recommendationData.error_code && recommendationData.error_code !== null) {
            errorMessage = `Error ${recommendationData.error_code}: ${recommendationData.error_explanation || 'Error desconocido'}`;
        }
        
        // Check for los_viable status
        if (recommendationData.los_viable === false) {
            errorMessage = 'No hay línea de vista viable para esta ubicación.';
        }
        
        // Additional validation: check if we have viable kits
        if (!recommendationData.viable_kits || !Array.isArray(recommendationData.viable_kits) || recommendationData.viable_kits.length === 0) {
            if (!errorMessage) {
                errorMessage = 'No se encontraron kits viables para esta ubicación.';
            }
        }
    }
    
    return {
        data: recommendationData,
        error: errorMessage
    };
}

// Function to handle different types of errors from kit recommendations
function handleKitRecommendationError(errorMessage, section = 'recommendations', requestData = null) {
    console.error('Kit recommendation error:', errorMessage);
    
    // Check if this is a timeout error and provide more helpful message
    let displayMessage = errorMessage;
    if (errorMessage.includes('timed out') || errorMessage.includes('timeout') || errorMessage.includes('504')) {
        displayMessage = 'La solicitud tardó demasiado tiempo en completarse. El servidor puede estar ocupado. Por favor, inténtelo de nuevo.';
    } else if (errorMessage.includes('500')) {
        displayMessage = 'Error interno del servidor. El sistema puede estar experimentando problemas temporales. Por favor, inténtelo de nuevo.';
    }
    
    // Show error message to user
    showStatusMessage(displayMessage, 'error', section);
    
    // Hide loading states
    hideLoadingBlock(section);
    
    // Show recommendation block but with error state
    if (recommendationBlock) {
        recommendationBlock.style.display = 'block';
        setTimeout(() => {
            recommendationBlock.classList.add('visible');
        }, 100);
    }
    
    // Hide loading, show error content
    const recommendationLoading = document.getElementById('recommendation-loading');
    const recommendationContent = document.getElementById('recommendation-content');
    
    if (recommendationLoading) {
        recommendationLoading.style.display = 'none';
    }
    if (recommendationContent) {
        recommendationContent.style.display = 'block';
        
        // Enhanced error display with better formatting
        let errorDisplay = displayMessage;
        
        // Check if error message contains error code format (Error XXX: description)
        if (displayMessage.includes('Error ') && displayMessage.includes(':')) {
            const parts = displayMessage.split(':');
            const errorCode = parts[0].trim();
            const errorDescription = parts.slice(1).join(':').trim();
            
            errorDisplay = `
                <div class="error-code" style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem; color: #ff6b6b;">
                    ${errorCode}
                </div>
                <div class="error-description" style="font-size: 1rem; color: #ff6b6b; margin-bottom: 1.5rem;">
                    ${errorDescription}
                </div>
            `;
        } else {
            errorDisplay = `<p style="margin-bottom: 1.5rem;">${displayMessage}</p>`;
        }
        
        recommendationContent.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 2rem; color: #ff6b6b; background: rgba(255, 107, 107, 0.1); border-radius: 8px; border: 1px solid rgba(255, 107, 107, 0.3);">
                <h3 style="margin-bottom: 1rem; color: #ff6b6b;">Error en las Recomendaciones</h3>
                ${errorDisplay}
                <button id="retry_agent_response_kit" onclick="retryKitRecommendations()" style="
                    margin-top: 1rem; 
                    padding: 1rem 2rem; 
                    background: #ffffff; 
                    color: #000000; 
                    border: none; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 1rem;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                ">
                    Reintentar
                </button>
            </div>
        `;
        
        // Add hover effects to the retry button
        const retryButton = document.getElementById('retry_agent_response_kit');
        if (retryButton) {
            retryButton.onmouseover = function() {
                this.style.background = '#f0f0f0';
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
            };
            retryButton.onmouseout = function() {
                this.style.background = '#ffffff';
                this.style.transform = 'none';
                this.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            };
            retryButton.onmousedown = function() {
                this.style.transform = 'translateY(0)';
            };
            retryButton.onmouseup = function() {
                this.style.transform = 'translateY(-2px)';
            };
        }
        
        // Store request data for retry functionality
        if (requestData) {
            window.lastKitRequestData = requestData;
        }
    }
}

// Function to retry kit recommendations
async function retryKitRecommendations() {
    console.log('Retrying kit recommendations...');
    
    // Get the stored request data
    const requestData = window.lastKitRequestData;
    if (!requestData) {
        showStatusMessage('No hay datos de solicitud disponibles para reintentar', 'error', 'recommendations');
        return;
    }
    
    // Disable retry button and show loading state
    const retryButton = document.getElementById('retry_agent_response_kit');
    if (retryButton) {
        retryButton.disabled = true;
        retryButton.textContent = 'Reintentando...';
        retryButton.style.opacity = '0.7';
        retryButton.style.cursor = 'not-allowed';
    }
    
    // Clear previous error message
    hideStatusMessage('recommendations');
    
    // Show loading state
    showLoadingBlock('recommendations');
    showStatusMessage('Reintentando obtener recomendaciones...', 'info', 'recommendations');
    
    // Hide error content and show loading
    const recommendationContent = document.getElementById('recommendation-content');
    const recommendationLoading = document.getElementById('recommendation-loading');
    
    if (recommendationContent) {
        recommendationContent.style.display = 'none';
    }
    if (recommendationLoading) {
        recommendationLoading.style.display = 'flex';
    }
    
    try {
        // Send POST request to n8n selection webhook with extended timeout
        const response = await fetchWithTimeout(n8nSelectionWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        }, 300000); // 5 minute timeout to match API timeout

        if (!response.ok) {
            throw new Error(`Server responded with error: ${response.status} ${response.statusText}`);
        }

        const responseData = await response.json();
        
        hideLoadingBlock('recommendations');
        
        // Log success
        console.log('Retry successful:', responseData);
        showStatusMessage('Recomendaciones obtenidas exitosamente', 'success', 'recommendations');
        
        // Handle kit recommendations if present in response
        if (responseData) {
            const { data: recommendationData, error: errorMessage } = extractKitRecommendationData(responseData);
            
            // If there's an error, display it and don't show recommendations
            if (errorMessage) {
                handleKitRecommendationError(errorMessage, 'recommendations', requestData);
                return;
            }
            
            // If we have recommendation data, display it
            if (recommendationData) {
                displayKitRecommendations(recommendationData);
            } else {
                showStatusMessage('No se encontraron recomendaciones de kits en el reintento', 'error', 'recommendations');
                // Show error state again
                handleKitRecommendationError('No se encontraron recomendaciones de kits en el reintento', 'recommendations', requestData);
            }
        }
        
    } catch (error) {
        hideLoadingBlock('recommendations');
        
        // Log error
        console.error('Error in retry:', error);
        showStatusMessage(`Error en el reintento: ${error.message}`, 'error', 'recommendations');
        
        // Show error state again
        handleKitRecommendationError(`Error en el reintento: ${error.message}`, 'recommendations', requestData);
    } finally {
        // Reset retry button
        if (retryButton) {
            retryButton.disabled = false;
            retryButton.textContent = 'Reintentar';
            retryButton.style.opacity = '1';
            retryButton.style.cursor = 'pointer';
        }
    }
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

    // Get the complete SOP data (should include all fields and elevation data)
    const completeSopData = allSopData[selectedResultId];
    
    if (!completeSopData) {
        showStatusMessage('Error: Complete SOP data not found', 'error');
        return;
    }
    
    // Store confirmed SOP for final report (store the full object)
    // Ensure all required fields are present for report rendering
    let sopToStore = JSON.parse(JSON.stringify(completeSopData));
    if (!('status' in sopToStore)) sopToStore.status = sopToStore.lineOfSight?.hasLineOfSight ? 'Clear' : 'Blocked';
    if (!('results' in sopToStore)) sopToStore.results = [];
    if (!('lineOfSight' in sopToStore)) sopToStore.lineOfSight = null;
    confirmedSOP = {
        id: selectedResultId,
        data: sopToStore
    };
    // Debug: Log the complete SOP data being sent (can be removed in production)
    console.log('Retrieved complete SOP data for', selectedResultId, ':', sopToStore);
    console.log('Bandwidth being sent:', storedBandwidth);

    // Prepare the request data with complete SOP information, bandwidth, and AigentID
    const requestData = {
        selectedResultId: selectedResultId,
        completeSopData: completeSopData, // Include the complete data
        bandwidth: storedBandwidth, // Include the stored bandwidth value
        AigentID: currentAigentID // Include the current AigentID
    };
    console.log('SOP Selection request data being sent:', requestData);
    console.log('Bandwidth being sent to SOP selection endpoint:', storedBandwidth);

    try {
        scrollToSection('recommendations');
        setTimeout(() => {
            showLoadingBlock('recommendations');
            showStatusMessage('Sending selection to server...', 'info', 'recommendations');
        }, 500);
        
        // Send POST request to n8n selection webhook with extended timeout
        const response = await fetchWithTimeout(n8nSelectionWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        }, 300000); // 5 minute timeout to match API timeout

        if (!response.ok) {
            throw new Error(`Server responded with error: ${response.status} ${response.statusText}`);
        }

        const responseData = await response.json();
        
        hideLoadingBlock('recommendations');
        
        // Log success with complete data
        console.log('Selection sent successfully:', responseData);
        console.log('Complete SOP data sent:', completeSopData);
        console.log('AigentID used:', currentAigentID);
        showStatusMessage(`Selection confirmed: ${selectedResultId}`, 'success', 'recommendations');
        
        // Handle kit recommendations if present in response
        if (responseData) {
            const { data: recommendationData, error: errorMessage } = extractKitRecommendationData(responseData);
            
            // If there's an error, display it and don't show recommendations
            if (errorMessage) {
                handleKitRecommendationError(errorMessage, 'recommendations', requestData);
                return;
            }
            
            // If we have recommendation data, display it
            if (recommendationData) {
                displayKitRecommendations(recommendationData);
            } else {
                console.log('No kit recommendations found in response:', responseData);
                showStatusMessage('No se encontraron recomendaciones de kits. Reintentando...', 'info');
                
                // Retry after 2 seconds
                setTimeout(async () => {
                    try {
                        showStatusMessage('Reintentando obtener recomendaciones...', 'info');
                        const retryResponse = await fetchWithTimeout(n8nSelectionWebhookUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(requestData)
                        }, 300000); // 5 minute timeout to match API timeout
                        
                        if (retryResponse.ok) {
                            const retryData = await retryResponse.json();
                            const { data: retryRecommendationData, error: retryErrorMessage } = extractKitRecommendationData(retryData);
                            
                            if (retryErrorMessage) {
                                handleKitRecommendationError(retryErrorMessage, 'recommendations', requestData);
                                return;
                            }
                            
                            if (retryRecommendationData) {
                                showStatusMessage('Recomendaciones obtenidas en el segundo intento', 'success');
                                displayKitRecommendations(retryRecommendationData);
                            } else {
                                showStatusMessage('No se pudieron obtener recomendaciones después del reintento', 'error');
                            }
                        } else {
                            showStatusMessage('Error en el reintento: ' + retryResponse.status, 'error');
                        }
                    } catch (retryError) {
                        showStatusMessage('Error en el reintento: ' + retryError.message, 'error');
                    }
                }, 2000);
            }
        }
        
    } catch (error) {
        hideLoadingBlock('recommendations');
        
        // Log error
        console.error('Error sending selection:', error);
        showStatusMessage(`Error sending selection: ${error.message}`, 'error', 'recommendations');
    } finally {
        // Keep containers open and smoothly move to recommendations section
        setTimeout(() => {
            scrollToSection('recommendations');
        }, 1000);
    }
}

// Function to display kit recommendations
function displayKitRecommendations(recommendationData) {
    console.log('Displaying kit recommendations:', recommendationData);
    
    // Keep the first results block visible but show recommendation block
    if (firstResultsBlock) {
        firstResultsBlock.style.display = 'block';
        firstResultsBlock.classList.add('visible');
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
    // Show final report block
    if (finalReportBlock) {
        finalReportBlock.style.display = 'block';
        setTimeout(() => {
            finalReportBlock.classList.add('visible');
        }, 100);
    }
    // Populate report data
    populateFinalReport();
    // Enable the export button after report is populated
    const exportBtn = document.getElementById('download-pdf-button');
    if (exportBtn) exportBtn.disabled = false;
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

// Helper to check if report is populated
function isReportPopulated() {
    return (
        document.getElementById('report-date')?.textContent.trim() &&
        document.getElementById('report-aigent-id')?.textContent.trim() &&
        document.getElementById('report-coordinates')?.textContent.trim() &&
        document.getElementById('report-bandwidth')?.textContent.trim()
    );
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
    
    // Debug logging to help identify data issues
    console.log('Populating SOP details with data:', sopData);
    console.log('SOP data results array:', sopData.results);
    console.log('SOP data lineOfSight:', sopData.lineOfSight);
    
    // Defensive: fallback for status
    const isSuccess = sopData.status === 'Clear' || sopData.status === 'clear' || sopData.lineOfSight?.hasLineOfSight;
    const chartId = `report-chart-${sopData.SOP ? sopData.SOP.replace('-', '') : 'unknown'}`;
    sopDetailsContainer.innerHTML = `
        <div class="card-header">
            <div class="card-title" style="color:#222;">${sopData.SOP || sopData.id || 'SOP'} - ${sopData.Plaza || sopData.plaza || ''}</div>
            <div class="status-badge ${isSuccess ? 'status-success' : 'status-blocked'}" style="color:#fff;">
                ${isSuccess ? '✓ Clear' : '✗ Blocked'}
            </div>
        </div>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label" style="color:#333;">Distance</div>
                <div class="info-value" style="color:#222;">${sopData.distance_km || sopData.distance || 'N/A'} km</div>
            </div>
            <div class="info-item">
                <div class="info-label" style="color:#333;">Coordinates</div>
                <div class="info-value" style="color:#222;">${sopData.Coordenadas || sopData.coordinates || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label" style="color:#333;">Elevation</div>
                <div class="info-value" style="color:#222;">${sopData.elevation || sopData['Altura (mts)'] || 'N/A'} m</div>
            </div>
            <div class="info-item">
                <div class="info-label" style="color:#333;">Status</div>
                <div class="info-value" style="color:#222;">${sopData.status || (sopData.lineOfSight?.hasLineOfSight ? 'Clear' : 'Blocked') || 'N/A'}</div>
            </div>
        </div>
        <div class="recommendation" style="margin-top:1rem;color:#222;">
            <strong>Recommendation:</strong> ${sopData.lineOfSight?.summary?.recommendation || 'Analysis completed'}
        </div>
        <div class="chart-container" style="height:220px; margin-top:1.5rem;">
            <div class="chart-title" style="color:#222;">Elevation Profile</div>
            <canvas id="${chartId}" style="max-width:100%;height:200px;"></canvas>
        </div>
    `;
    setTimeout(() => {
        console.log('Attempting to create elevation chart with ID:', chartId);
        console.log('Chart data check - results array:', Array.isArray(sopData.results));
        console.log('Chart data check - results length:', sopData.results?.length);
        console.log('Chart data check - lineOfSight exists:', !!sopData.lineOfSight);
        
        if (Array.isArray(sopData.results) && sopData.results.length > 0 && sopData.lineOfSight) {
            console.log('Creating elevation chart with data:', sopData);
            createElevationChart(sopData, chartId);
        } else {
            const canvas = document.getElementById(chartId);
            if (canvas) canvas.parentElement.innerHTML += '<p class="no-data" style="color:#c00;text-align:center;">No elevation data available.</p>';
            console.warn('No elevation data for SOP chart. Data structure:', {
                hasResults: Array.isArray(sopData.results),
                resultsLength: sopData.results?.length,
                hasLineOfSight: !!sopData.lineOfSight,
                sopData: sopData
            });
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
        showLoadingBlock('report');
        showStatusMessage('Sending kit selection to server...', 'info', 'report');
        
        // Prepare the request data
        const requestData = {
            selectedKit: window.selectedKitData,
            AigentID: currentAigentID,
            bandwidth: storedBandwidth // Include the stored bandwidth value
        };
        console.log('KIT Selection request data being sent:', requestData);
        console.log('Bandwidth being sent to KIT selection endpoint:', storedBandwidth);
        
        // Send POST request to kit selection webhook with timeout
        const response = await fetchWithTimeout(n8nKitSelectionWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        }, 60000); // 60 second timeout
        
        if (!response.ok) {
            throw new Error(`Server responded with error: ${response.status} ${response.statusText}`);
        }
        
        const responseData = await response.json();
        
        console.log('Kit selection sent successfully:', responseData);
        showStatusMessage(`Kit selection confirmed: ${window.selectedKitData.name}`, 'success', 'report');
        
        // Store confirmed kit for final report
        confirmedKit = window.selectedKitData;
        
        // Hide loading and show success state
        hideKitConfirmationLoading();
        
        // Reset button
        if (confirmKitButton) {
            confirmKitButton.disabled = false;
            confirmKitButton.textContent = 'Confirmar Selección de Kit';
        }
        
        // Show final report and scroll to it
        showFinalReport();
        setTimeout(() => {
            scrollToSection('report');
        }, 1000);
        
    } catch (error) {
        console.error('Error sending kit selection:', error);
        showStatusMessage(`Error sending kit selection: ${error.message}`, 'error', 'report');
        
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
    
    // Update AigentID if present in the new format
    if (data.aigent_id && data.aigent_id !== currentAigentID) {
        currentAigentID = data.aigent_id;
        updateAigentIDDisplay(currentAigentID);
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

// Utility to show status message in a specific section
function showStatusMessage(message, type = 'info', section = 'analysis') {
    let statusEl = document.getElementById(`status-message-${section}`);
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `status-message status-${type}`;
    statusEl.style.display = 'block';
}
function hideStatusMessage(section = 'analysis') {
    let statusEl = document.getElementById(`status-message-${section}`);
    if (!statusEl) return;
    statusEl.style.display = 'none';
}
function showLoadingBlock(section = 'analysis') {
    let loadingEl = document.getElementById(`loading-block-${section}`);
    if (!loadingEl) return;
    loadingEl.style.display = 'block';
}
function hideLoadingBlock(section = 'analysis') {
    let loadingEl = document.getElementById(`loading-block-${section}`);
    if (!loadingEl) return;
    loadingEl.style.display = 'none';
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
        firstResultsBlock.classList.remove('visible');
        setTimeout(() => {
            firstResultsBlock.style.display = 'none';
            firstResultsBlock.querySelector('.results-container').innerHTML = '';
        }, 400);
        if (recommendationBlock) {
            recommendationBlock.classList.remove('visible');
            setTimeout(() => {
                recommendationBlock.style.display = 'none';
            }, 400);
        }
        const clientAddressInput = document.querySelector('#client-address-input');
        const clientAddress = clientAddressInput.value.trim();
        const bandwidth = bandwidthInput.value.trim();
        if (!clientAddress) {
            showStatusMessage('Por favor, introduzca una dirección o coordenadas.', 'error');
            return;
        }
        if (!bandwidth) {
            showStatusMessage('Por favor, introduzca el ancho de banda requerido.', 'error');
            return;
        }
        storedBandwidth = bandwidth;
        inputBandwidth = bandwidth;
        inputCoordinates = clientAddress;
        console.log('Bandwidth stored:', storedBandwidth);
        hideStatusMessage();
        
        // Provide immediate visual feedback and scroll to analysis section
        confirmAddressButton.disabled = true;
        confirmAddressButton.textContent = 'Procesando...';
        
        // Scroll to analysis section immediately when button is clicked
        scrollToSection('analysis');
        
        const requestData = { 
            clientAddress: clientAddress,
            bandwidth: storedBandwidth // Include the stored bandwidth value
        };
        console.log('Coordinates request data being sent:', requestData);
        console.log('Bandwidth being sent to coordinates endpoint:', storedBandwidth);
        try {
            showLoadingBlock('analysis');
            showStatusMessage('Conectando con el servidor...', 'info', 'analysis');
            showStatusMessage('Enviando datos al servidor...', 'info', 'analysis');
            
            // Ensure we're still in the analysis section after loading starts
            setTimeout(() => {
                scrollToSection('analysis');
            }, 100);
            
            const response = await fetchWithTimeout(n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            }, 60000); // 60 second timeout
            if (!response.ok) {
                throw new Error('El servidor respondió con un error (' + response.status + ')');
            }
            showStatusMessage('Procesando respuesta del servidor...', 'info');
            const responseData = await response.json();
            const validatedData = validateAndExtractResponseData(responseData);
            if (!validatedData) {
                throw new Error('La respuesta del servidor no tiene el formato esperado.');
            }
            if (validatedData.aigentID) {
                currentAigentID = validatedData.aigentID;
                console.log('Received AigentID:', currentAigentID);
                updateAigentIDDisplay(currentAigentID);
            } else {
                console.warn('No AigentID received in response');
            }
            const results = validatedData.results;
            if (!results.trueResults && !results.falseResults) {
                throw new Error('Los resultados no contienen datos válidos de análisis.');
            }
            hideLoadingBlock('analysis');
            setTimeout(() => {
                populateResultsBlock(results);
                firstResultsBlock.style.display = 'block';
                setTimeout(() => {
                    firstResultsBlock.classList.add('visible');
                    // Show and enable confirm selection button only now
                    const confirmSelectionBtn = document.getElementById('confirm-selection-button');
                    if (confirmSelectionBtn) {
                        confirmSelectionBtn.style.display = 'block';
                        confirmSelectionBtn.classList.add('enabled');
                        // Apply same design as confirm-address-button
                        confirmSelectionBtn.style.background = '#ffffff';
                        confirmSelectionBtn.style.color = '#000000';
                        confirmSelectionBtn.style.border = 'none';
                        confirmSelectionBtn.style.padding = '1rem 2rem';
                        confirmSelectionBtn.style.fontSize = '1rem';
                        confirmSelectionBtn.style.fontWeight = '500';
                        confirmSelectionBtn.style.cursor = 'pointer';
                        confirmSelectionBtn.style.transition = 'all 0.3s ease';
                        confirmSelectionBtn.style.textTransform = 'uppercase';
                        confirmSelectionBtn.style.letterSpacing = '1px';
                        confirmSelectionBtn.style.borderRadius = '4px';
                        confirmSelectionBtn.onmouseover = function() {
                            this.style.background = '#f0f0f0';
                            this.style.transform = 'translateY(-2px)';
                            this.style.boxShadow = '0 5px 15px rgba(255, 255, 255, 0.2)';
                        };
                        confirmSelectionBtn.onmouseout = function() {
                            this.style.background = '#ffffff';
                            this.style.transform = 'none';
                            this.style.boxShadow = 'none';
                        };
                        confirmSelectionBtn.onmousedown = function() {
                            this.style.transform = 'translateY(0)';
                        };
                        confirmSelectionBtn.onmouseup = function() {
                            this.style.transform = 'translateY(-2px)';
                        };
                    }
                    // Ensure we're still in the analysis section after results load
                    setTimeout(() => {
                        scrollToSection('analysis');
                    }, 100);
                }, 50);
                showStatusMessage(`¡Análisis completado! (ID: ${currentAigentID || 'N/A'})`, 'success', 'analysis');
            }, 700);
        } catch (error) {
            hideLoadingBlock('analysis');
            showStatusMessage('Error: ' + (error.message || error), 'error', 'analysis');
        } finally {
            // Reset button state
            confirmAddressButton.disabled = false;
            confirmAddressButton.textContent = 'Confirmar';
        }
    });
}

// Function to populate results block with dynamic content (card-based, sectioned)
function populateResultsBlock(responseData) {
    const resultsContainer = firstResultsBlock.querySelector('.results-container');
    resultsContainer.innerHTML = '';
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
    // Hide confirm selection button by default
    const confirmSelectionBtnBlock = document.getElementById('confirm-selection-button');
    if (confirmSelectionBtnBlock) {
        confirmSelectionBtnBlock.style.display = 'none';
        confirmSelectionBtnBlock.classList.remove('enabled');
    }
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
        const confirmSelectionBtn = document.getElementById('confirm-selection-button');
        if (confirmSelectionBtn) {
            confirmSelectionBtn.classList.add('enabled');
        }
    }

    // Clear and add sections
    resultsContainer.innerHTML = '';

    // Reset confirm selection button state
    const confirmSelectionBtnReset = document.getElementById('confirm-selection-button');
    if (confirmSelectionBtnReset) {
        confirmSelectionBtnReset.classList.remove('enabled');
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
// Improved PDF generation function with better formatting
async function downloadPDF() {
    console.log('Generating PDF report...');
    const downloadButton = document.getElementById('download-pdf-button');
    // Update button state
    if (downloadButton) {
        downloadButton.disabled = true;
        downloadButton.innerHTML = '<span class="download-icon">⏳</span> Generando PDF...';
    }
    try {
        const reportContainer = document.querySelector('.final-report-container');
        if (!reportContainer) {
            throw new Error('Report container not found');
        }
        // Debug: Log all values before export
        const debugValues = {};
        reportContainer.querySelectorAll('.input-value, .info-value, .kit-detail-value').forEach(el => {
            debugValues[el.id || el.className || el.parentNode?.className] = el.textContent;
        });
        console.log('PDF Export - Values in DOM:', debugValues);
        // Ensure all required fields are populated
        const requiredFields = [
            'report-date',
            'report-aigent-id',
            'report-timestamp',
            'report-coordinates',
            'report-bandwidth'
        ];
        let missingFields = [];
        for (const id of requiredFields) {
            const el = reportContainer.querySelector(`#${id}`);
            if (!el || !el.textContent.trim()) {
                missingFields.push(id);
            }
        }
        if (missingFields.length > 0) {
            alert('Algunos campos requeridos no están poblados en el reporte: ' + missingFields.join(', '));
            if (downloadButton) {
                downloadButton.disabled = false;
                downloadButton.innerHTML = '<span class="download-icon">📄</span> Descargar Reporte PDF';
            }
            return;
        }
        // Create a dedicated PDF container
        const pdfWrapper = document.createElement('div');
        pdfWrapper.style.cssText = `
            position: fixed;
            top: -10000px;
            left: -10000px;
            width: 794px;
            background: white;
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.4;
            color: #333;
            padding: 40px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;
        // Clone the report container with deep cloning (ensure it's the visible, populated one)
        const pdfContainer = reportContainer.cloneNode(true);
        // Remove the download button from PDF
        const pdfDownloadButton = pdfContainer.querySelector('.download-pdf-button');
        if (pdfDownloadButton) {
            pdfDownloadButton.parentNode.removeChild(pdfDownloadButton);
        }
        // Apply comprehensive PDF styles
        applyPDFStyles(pdfContainer);
        // Handle charts and canvas elements
        await handleChartsForPDF(reportContainer, pdfContainer);
        // Add the container to wrapper and DOM
        pdfWrapper.appendChild(pdfContainer);
        document.body.appendChild(pdfWrapper);
        // Wait for any dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 500));
        // Configure PDF options with optimized settings
        const opt = {
            margin: [20, 20, 20, 20],
            filename: `Agente_Geografico_Report_${currentAigentID || 'N/A'}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { 
                type: 'jpeg', 
                quality: 0.95 
            },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                scrollY: 0,
                windowWidth: 794,
                windowHeight: 1123,
                onclone: function(clonedDoc) {
                    // Ensure all styles are properly applied in the cloned document
                    const clonedContainer = clonedDoc.querySelector('.final-report-container');
                    if (clonedContainer) {
                        applyPDFStyles(clonedContainer);
                    }
                }
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait',
                compress: true
            },
            pagebreak: { 
                mode: ['avoid-all', 'css'],
                before: '.report-section',
                after: '.page-break-after'
            }
        };
        // Generate PDF
        await html2pdf().set(opt).from(pdfWrapper).save();
        console.log('PDF generated successfully');
        showStatusMessage('PDF generado y descargado exitosamente', 'success');
    } catch (error) {
        console.error('Error generating PDF:', error);
        showStatusMessage('Error al generar el PDF: ' + error.message, 'error');
    }
    // Clean up
    const pdfWrapper = document.querySelector('div[style*="position: fixed"][style*="top: -10000px"]');
    if (pdfWrapper) {
        document.body.removeChild(pdfWrapper);
    }
    // Reset button
    if (downloadButton) {
        downloadButton.disabled = false;
        downloadButton.innerHTML = '<span class="download-icon">📄</span> Descargar Reporte PDF';
    }
}

// Function to apply comprehensive PDF styles
function applyPDFStyles(container) {
    // Main container styles
    container.style.cssText = `
        background: white !important;
        color: #333 !important;
        font-family: Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
        max-width: 900px !important;
        margin: 0 auto !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
    `;

    // Report header styles
    const reportHeader = container.querySelector('.report-header');
    if (reportHeader) {
        reportHeader.style.cssText = `
            margin-bottom: 30px !important;
            padding: 20px !important;
            background: #f8f9fa !important;
            border: 1px solid #dee2e6 !important;
            border-radius: 8px !important;
            page-break-inside: avoid !important;
        `;
        
        const h3 = reportHeader.querySelector('h3');
        if (h3) {
            h3.style.cssText = `
                color: #2c5aa0 !important;
                font-size: 24px !important;
                font-weight: bold !important;
                margin: 0 0 15px 0 !important;
                text-align: center !important;
            `;
        }
    }

    // Report meta styles
    const reportMeta = container.querySelector('.report-meta');
    if (reportMeta) {
        reportMeta.style.cssText = `
            background: white !important;
            border: 1px solid #dee2e6 !important;
            border-radius: 4px !important;
            padding: 15px !important;
            margin-top: 15px !important;
            page-break-inside: avoid !important;
        `;
        
        const metaItems = reportMeta.querySelectorAll('p');
        metaItems.forEach(item => {
            item.style.cssText = `
                margin: 8px 0 !important;
                color: #333 !important;
                font-size: 14px !important;
            `;
            
            const span = item.querySelector('span');
            if (span) {
                span.style.cssText = `
                    color: #2c5aa0 !important;
                    font-weight: bold !important;
                `;
            }
        });
    }

    // Report sections styles
    const reportSections = container.querySelectorAll('.report-section');
    reportSections.forEach(section => {
        section.style.cssText = `
            margin: 25px 0 !important;
            padding: 20px !important;
            background: #f8f9fa !important;
            border: 1px solid #dee2e6 !important;
            border-radius: 8px !important;
            page-break-inside: avoid !important;
        `;
        
        const h4 = section.querySelector('h4');
        if (h4) {
            h4.style.cssText = `
                color: #2c5aa0 !important;
                font-size: 18px !important;
                font-weight: bold !important;
                margin: 0 0 15px 0 !important;
                border-bottom: 2px solid #2c5aa0 !important;
                padding-bottom: 8px !important;
            `;
        }
    });

    // Input details styles
    const inputDetails = container.querySelector('.input-details');
    if (inputDetails) {
        inputDetails.style.cssText = `
            background: white !important;
            border: 1px solid #dee2e6 !important;
            border-radius: 4px !important;
            padding: 15px !important;
        `;
        
        const inputItems = inputDetails.querySelectorAll('.input-item');
        inputItems.forEach(item => {
            item.style.cssText = `
                margin: 10px 0 !important;
                display: flex !important;
                align-items: center !important;
                flex-wrap: wrap !important;
            `;
            
            const label = item.querySelector('.input-label');
            if (label) {
                label.style.cssText = `
                    font-weight: bold !important;
                    color: #555 !important;
                    margin-right: 10px !important;
                    min-width: 150px !important;
                `;
            }
            
            const value = item.querySelector('.input-value');
            if (value) {
                value.style.cssText = `
                    color: #2c5aa0 !important;
                    font-weight: bold !important;
                    background: #f8f9fa !important;
                    padding: 4px 8px !important;
                    border-radius: 4px !important;
                    border: 1px solid #dee2e6 !important;
                `;
            }
        });
    }

    // SOP and Kit details styles
    const sopDetails = container.querySelector('.sop-details');
    if (sopDetails) {
        sopDetails.style.cssText = `
            background: white !important;
            border: 1px solid #dee2e6 !important;
            border-radius: 4px !important;
            padding: 15px !important;
            page-break-inside: avoid !important;
        `;
    }

    const kitDetails = container.querySelector('.kit-details');
    if (kitDetails) {
        kitDetails.style.cssText = `
            background: white !important;
            border: 1px solid #dee2e6 !important;
            border-radius: 4px !important;
            padding: 15px !important;
            page-break-inside: avoid !important;
        `;
    }

    // Apply styles to all text elements
    const allTextElements = container.querySelectorAll('*');
    allTextElements.forEach(element => {
        if (element.nodeType === 1) {
            const computedStyle = window.getComputedStyle(element);
            if (computedStyle.color !== 'rgb(51, 51, 51)') {
                element.style.color = '#333 !important';
            }
        }
    });
}

// Function to handle charts and canvas elements for PDF
async function handleChartsForPDF(originalContainer, pdfContainer) {
    const originalCanvases = originalContainer.querySelectorAll('canvas');
    const pdfCanvases = pdfContainer.querySelectorAll('canvas');
    
    for (let i = 0; i < originalCanvases.length; i++) {
        const originalCanvas = originalCanvases[i];
        const pdfCanvas = pdfCanvases[i];
        
        if (originalCanvas && pdfCanvas) {
            try {
                // Create image from canvas
                const img = document.createElement('img');
                img.src = originalCanvas.toDataURL('image/png', 0.95);
                
                // Style the image for PDF
                img.style.cssText = `
                    display: block !important;
                    max-width: 100% !important;
                    height: auto !important;
                    margin: 10px auto !important;
                    border: 1px solid #dee2e6 !important;
                    border-radius: 4px !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
                `;
                
                // Replace canvas with image
                pdfCanvas.parentNode.replaceChild(img, pdfCanvas);
                
                // Wait for image to load
                await new Promise((resolve) => {
                    if (img.complete) {
                        resolve();
                    } else {
                        img.onload = resolve;
                        img.onerror = resolve;
                    }
                });
            } catch (error) {
                console.warn('Error converting canvas to image:', error);
            }
        }
    }
}

// Function to scroll to a specific section
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        // Use both scrollIntoView and window.scrollTo for better compatibility
        try {
            section.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        } catch (error) {
            // Fallback to window.scrollTo if scrollIntoView fails
            const offsetTop = section.offsetTop - 80; // Account for fixed navbar
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
        
        // Double-check scroll position after a short delay
        setTimeout(() => {
            const currentScrollTop = window.pageYOffset;
            const sectionTop = section.offsetTop - 80;
            const tolerance = 50; // Allow some tolerance
            
            if (Math.abs(currentScrollTop - sectionTop) > tolerance) {
                window.scrollTo({
                    top: sectionTop,
                    behavior: 'smooth'
                });
            }
        }, 300);
    }
}

// Initialize page state and ensure home section is visible
function initializePageState() {
    // Disable browser scroll restoration to prevent remembering previous position
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    
    // Reset any URL hash to ensure clean state
    if (window.location.hash && window.location.hash !== '#home') {
        history.replaceState(null, null, window.location.pathname);
    }
    
    // Force scroll to top immediately
    window.scrollTo(0, 0);
    
    // Ensure home section is visible and at the top
    const homeSection = document.getElementById('home');
    if (homeSection) {
        homeSection.style.display = 'block';
        homeSection.style.visibility = 'visible';
        homeSection.style.opacity = '1';
    }
    
    // Scroll to home section with a slight delay to ensure DOM is ready
    setTimeout(() => {
        scrollToSection('home');
    }, 50);
}

// Auto-scroll to home section on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded - Initializing page state');
    // Force scroll to top immediately
    window.scrollTo(0, 0);
    // Initialize page state
    initializePageState();
});

// Also handle page refresh and direct navigation
window.addEventListener('load', function() {
    console.log('Window load - Double-checking page state');
    // Force scroll to top immediately
    window.scrollTo(0, 0);
    // Double-check we're at home section after everything loads
    setTimeout(() => {
        initializePageState();
    }, 200);
});

// Handle browser back/forward buttons
window.addEventListener('popstate', function() {
    console.log('Popstate - Resetting to home');
    // Force scroll to top immediately
    window.scrollTo(0, 0);
    setTimeout(() => {
        initializePageState();
    }, 100);
});

// Handle page visibility changes (when user returns to tab)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('Page visible - Ensuring home section');
        // Force scroll to top immediately
        window.scrollTo(0, 0);
        setTimeout(() => {
            initializePageState();
        }, 100);
    }
});

// Additional event listener for beforeunload to ensure clean state
window.addEventListener('beforeunload', function() {
    // Force scroll to top before page unloads
    window.scrollTo(0, 0);
});

// Make test functions available globally
window.testKitRecommendations = testKitRecommendations;
window.testFinalReport = testFinalReport;
window.scrollToSection = scrollToSection;
window.retryKitRecommendations = retryKitRecommendations; 

function exportReportToPDF() {
    // 1. Select the final report block only
    const report = document.getElementById('final-report-block');
    if (!report) {
        alert('No final report found!');
        return;
    }
    // 2. Clone the report node
    const clone = report.cloneNode(true);
    // 3. Add a wrapper for A4 sizing and margin
    const wrapper = document.createElement('div');
    wrapper.style.width = '210mm'; // A4 width
    // Remove fixed height to allow content to flow naturally
    wrapper.style.background = '#fff';
    wrapper.style.margin = '0 auto';
    wrapper.style.padding = '20mm'; // A4 margin
    wrapper.style.boxSizing = 'border-box';
    wrapper.style.display = 'block'; // Use block instead of flex
    wrapper.style.fontFamily = 'Arial, sans-serif'; // Ensure font compatibility
    // 4. Add print-specific styles to the clone
    clone.classList.add('pdf-export');
    // Add CSS to prevent elements from breaking across pages
    const style = document.createElement('style');
    style.textContent = `
        .pdf-export {
            color: #000 !important;
            background: transparent !important;
        }
        .pdf-export * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        .pdf-export .report-section {
            margin-bottom: 10mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        .pdf-export .elevation-chart {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        .pdf-export table {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        .pdf-export h1, .pdf-export h2, .pdf-export h3 {
            page-break-after: avoid !important;
            break-after: avoid !important;
        }
    `;
    // 5. Append styles and clone to wrapper
    wrapper.appendChild(style);
    wrapper.appendChild(clone);
    // 6. Append wrapper to body (off-screen)
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    document.body.appendChild(wrapper);
    // 7. Generate PDF from the wrapper with updated options
    html2pdf(wrapper, {
        margin: 0, // No additional margin since we set it in CSS
        filename: 'reporte-final.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true,
            allowTaint: true,
            height: wrapper.scrollHeight, // Use actual content height
            windowHeight: wrapper.scrollHeight
        },
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait'
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] } // Enable page break control
    }).then(() => {
        // 8. Remove the wrapper after export
        document.body.removeChild(wrapper);
    }).catch((error) => {
        console.error('PDF generation failed:', error);
        document.body.removeChild(wrapper);
    });
}
window.exportReportToPDF = exportReportToPDF;

// --- Robust PDF Export for Testing ---
async function downloadPDFRobust() {
    if (!isReportPopulated()) {
        alert('El reporte no está listo. Por favor, complete el flujo antes de exportar.');
        return;
    }
    console.log('[PDF Robust] Starting export...');
    const downloadButton = document.getElementById('download-pdf-button');
    if (downloadButton) {
        downloadButton.disabled = true;
        downloadButton.innerHTML = '<span class="download-icon">⏳</span> Generando PDF...';
    }
    let wrapper = null;
    try {
        // Defensive: check for required elements
        const header = document.querySelector('.report-header');
        const sections = Array.from(document.querySelectorAll('.report-section'));
        if (!header || sections.length === 0) {
            alert('No report header or sections found.');
            return;
        }
        // Create wrapper for A4 sizing and margin
        wrapper = document.createElement('div');
        wrapper.style.width = '210mm';
        wrapper.style.background = '#fff';
        wrapper.style.margin = '0 auto';
        wrapper.style.padding = '20mm';
        wrapper.style.boxSizing = 'border-box';
        wrapper.style.display = 'block';
        wrapper.style.fontFamily = 'Arial, sans-serif';
        // Clone header and sections
        const headerClone = header.cloneNode(true);
        const sectionClones = sections.map(section => section.cloneNode(true));
        // Style header clone as card
        headerClone.style.background = '#f8f9fa';
        headerClone.style.border = '1px solid #dee2e6';
        headerClone.style.padding = '8px 16px';
        headerClone.style.borderRadius = '8px';
        // Append clones to wrapper
        wrapper.appendChild(headerClone);
        sectionClones.forEach(clone => wrapper.appendChild(clone));
        // Replace canvas with image in wrapper
        const origCanvases = document.querySelectorAll('canvas');
        const cloneCanvases = wrapper.querySelectorAll('canvas');
        for (let i = 0; i < cloneCanvases.length; i++) {
            const cloneCanvas = cloneCanvases[i];
            let origCanvas = null;
            if (cloneCanvas.id) {
                origCanvas = document.getElementById(cloneCanvas.id);
            } else {
                origCanvas = origCanvases[i];
            }
            if (origCanvas) {
                const img = document.createElement('img');
                img.src = origCanvas.toDataURL('image/png');
                img.style.display = 'block';
                img.style.maxWidth = '100%';
                img.style.height = cloneCanvas.style.height || '160px';
                cloneCanvas.replaceWith(img);
            }
        }
        // Add print-specific styles to the wrapper
        wrapper.classList.add('pdf-export');
        // Append wrapper to body (off-screen)
        wrapper.style.position = 'absolute';
        wrapper.style.left = '-9999px';
        document.body.appendChild(wrapper);
        // PDF options
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const pageWidth = 210, pageHeight = 297, margin = 10;
        const usableHeight = pageHeight - 2 * margin;
        // Render the wrapper to a canvas
        await new Promise(r => setTimeout(r, 100));
        const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#fff' });
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const imgProps = pdf.getImageProperties(imgData);
        let pdfWidth = pageWidth - 2 * margin;
        let pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        if (pdfHeight > usableHeight) {
            pdfHeight = usableHeight;
            pdfWidth = (imgProps.width * pdfHeight) / imgProps.height;
        }
        pdf.addImage(imgData, 'JPEG', margin, margin, pdfWidth, pdfHeight);
        pdf.save(`Agente_Geografico_Report_${window.currentAigentID || 'N/A'}_${new Date().toISOString().split('T')[0]}.pdf`);
        console.log('[PDF Robust] PDF generated successfully');
    } catch (error) {
        console.error('[PDF Robust] Error generating PDF:', error);
        alert('Error al generar el PDF: ' + error.message);
    } finally {
        if (wrapper && wrapper.parentNode) {
            wrapper.parentNode.removeChild(wrapper);
        }
        if (downloadButton) {
            downloadButton.disabled = false;
            downloadButton.innerHTML = '<span class="download-icon">📄</span> Descargar Reporte PDF (Test)';
        }
    }
}

// --- Unified PDF export for full final report container ---
async function downloadFinalReportPDF() {
    if (!isReportPopulated()) {
        alert('El reporte no está listo. Por favor, complete el flujo antes de exportar.');
        return;
    }
    const downloadButton = document.getElementById('download-pdf-button');
    if (downloadButton) {
        downloadButton.disabled = true;
        downloadButton.innerHTML = '<span class="download-icon">⏳</span> Generando PDF...';
    }

    let wrapper = null;
    try {
        const sourceContainer = document.querySelector('.final-report-container');
        if (!sourceContainer) throw new Error('Contenedor del reporte no encontrado');

        // Build off-screen wrapper sized for A4 width at ~96 DPI (~794px)
        wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.left = '-9999px';
        wrapper.style.top = '0';
        wrapper.style.width = '794px';
        wrapper.style.background = '#ffffff';
        wrapper.style.color = '#000000';
        wrapper.style.boxSizing = 'border-box';

        // Deep clone of the entire report container
        const clone = sourceContainer.cloneNode(true);

        // Remove download button inside the clone
        const btn = clone.querySelector('.download-pdf-button');
        if (btn && btn.parentNode) btn.parentNode.removeChild(btn);

        // Force light theme styles on the clone
        clone.style.background = '#ffffff';
        clone.style.color = '#222222';
        clone.style.maxWidth = '794px';
        clone.style.width = '100%';
        clone.style.margin = '0 auto';
        clone.style.padding = '0';

        // Apply additional PDF-friendly styles to children
        applyPDFStyles(clone);

        // Replace canvases with images (to include charts)
        await handleChartsForPDF(sourceContainer, clone);

        // Append to wrapper and to DOM
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        // Small delay to allow layout
        await new Promise(r => setTimeout(r, 100));

        // Render wrapper to canvas
        const canvas = await html2canvas(wrapper, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        // Initialize jsPDF and paginate if needed
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        await addCanvasAsMultipagePDF(pdf, canvas, 10);
        pdf.save(`Agente_Geografico_Report_${window.currentAigentID || 'N/A'}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
        console.error('[PDF Final] Error generating PDF:', error);
        alert('Error al generar el PDF: ' + error.message);
    } finally {
        if (wrapper && wrapper.parentNode) {
            wrapper.parentNode.removeChild(wrapper);
        }
        if (downloadButton) {
            downloadButton.disabled = false;
            downloadButton.innerHTML = '<span class="download-icon">📄</span> Descargar Reporte PDF';
        }
    }
}

// Helper: add a potentially tall canvas to jsPDF across multiple pages
async function addCanvasAsMultipagePDF(pdf, canvas, marginMm) {
    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const usableWidthMm = pageWidthMm - 2 * marginMm;
    const usableHeightMm = pageHeightMm - 2 * marginMm;

    const canvasWidthPx = canvas.width;
    const canvasHeightPx = canvas.height;

    // Pixels per mm at the drawing width
    const pxPerMm = canvasWidthPx / usableWidthMm;
    const segmentHeightPx = Math.floor(usableHeightMm * pxPerMm);

    let y = 0;
    let isFirstPage = true;
    while (y < canvasHeightPx) {
        const remainingPx = canvasHeightPx - y;
        const currentSegmentPx = Math.min(segmentHeightPx, remainingPx);

        // Create a temporary canvas for the segment
        const segmentCanvas = document.createElement('canvas');
        segmentCanvas.width = canvasWidthPx;
        segmentCanvas.height = currentSegmentPx;
        const ctx = segmentCanvas.getContext('2d');
        ctx.drawImage(
            canvas,
            0, y, canvasWidthPx, currentSegmentPx,
            0, 0, canvasWidthPx, currentSegmentPx
        );

        const imgData = segmentCanvas.toDataURL('image/jpeg', 0.98);
        const segmentHeightMm = currentSegmentPx / pxPerMm;

        if (!isFirstPage) pdf.addPage('a4', 'portrait');
        pdf.addImage(imgData, 'JPEG', marginMm, marginMm, usableWidthMm, segmentHeightMm);

        y += currentSegmentPx;
        isFirstPage = false;
    }
}

// Expose unified exporter globally for HTML onclick
window.downloadFinalReportPDF = downloadFinalReportPDF;