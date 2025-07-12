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

// Store complete SOP data for each result
let allSopData = {};

// Store bandwidth value
let storedBandwidth = '';

// Store AigentID for workflow tracking
let currentAigentID = null;

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
        
        // Log success with complete data
        console.log('Selection sent successfully:', responseData);
        console.log('Complete SOP data sent:', completeSopData);
        console.log('AigentID used:', currentAigentID);
        showStatusMessage(`Selection confirmed: ${selectedResultId}`, 'success');
        
        // Handle kit recommendations if present in response
        if (responseData) {
            let recommendationData = null;
            
            // Check if response has output property (direct format)
            if (responseData.output) {
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
    
    // Populate the recommendation block
    populateRecommendationBlock(recommendationData);
    
    // Show the recommendation block smoothly
    if (recommendationBlock) {
        recommendationBlock.style.display = 'block';
        setTimeout(() => {
            recommendationBlock.classList.add('visible');
        }, 100);
    }
    
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
    if (data.high_reliability_recommendation && highReliabilityContent) {
        highReliabilityContent.textContent = data.high_reliability_recommendation;
    } else {
        console.warn('No high_reliability_recommendation found');
    }
    
    if (data.best_value_recommendation && bestValueContent) {
        bestValueContent.textContent = data.best_value_recommendation;
    } else {
        console.warn('No best_value_recommendation found');
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

// Add event listener for kit dropdown
document.addEventListener('DOMContentLoaded', function() {
    const kitDropdown = document.getElementById('kit-dropdown');
    if (kitDropdown) {
        kitDropdown.addEventListener('change', function() {
            const selectedKit = this.value;
            if (selectedKit) {
                // Highlight the selected kit card
                const kitCards = document.querySelectorAll('.kit-card');
                kitCards.forEach(card => {
                    card.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                    card.style.transform = 'translateY(0)';
                });
                
                const selectedCard = Array.from(kitCards).find(card => 
                    card.querySelector('h4').textContent === selectedKit
                );
                
                if (selectedCard) {
                    selectedCard.style.borderColor = '#4CAF50';
                    selectedCard.style.transform = 'translateY(-4px)';
                    selectedCard.style.boxShadow = '0 12px 30px rgba(76, 175, 80, 0.3)';
                }
            }
        });
    }
});

// Vercel API Proxy URLs
const n8nWebhookUrl = '/api/get-coordinates';

// Vercel API Proxy Selection URL
const n8nSelectionWebhookUrl = '/api/get-SOP-selection';

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
        console.log('Bandwidth stored:', storedBandwidth);
        hideStatusMessage();
        // Prepare the request data
        const requestData = {
            clientAddress: clientAddress
        };
        
        try {
            showStatusMessage('Conectando con el servidor...', 'info');
            // Show loading block
            loadingBlock.style.display = 'block';
            setTimeout(() => {
                loadingBlock.classList.add('visible');
            }, 50);
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

            // Hide loading block
            loadingBlock.classList.remove('visible');
            setTimeout(() => {
                loadingBlock.style.display = 'none';
            }, 600);
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
            loadingBlock.classList.remove('visible');
            setTimeout(() => {
                loadingBlock.style.display = 'none';
            }, 600);
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