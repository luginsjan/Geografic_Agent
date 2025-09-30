// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all functionality
    initExpandableSections();
    initProgressBars();
    initReportGeneration();
    initKitSelection();
    initAnimations();
});

// Expandable Sections Functionality
function initExpandableSections() {
    const expandBtns = document.querySelectorAll('.expand-btn');
    
    expandBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const isExpanded = this.classList.contains('expanded');
            
            if (isExpanded) {
                collapseSection(this);
            } else {
                expandSection(this);
            }
        });
    });
}

function expandSection(btn) {
    const targetId = btn.getAttribute('data-target');
    const content = document.getElementById(targetId);
    
    if (content) {
        btn.classList.add('expanded');
        content.classList.add('expanded');
        
        // Set max-height to actual content height for smooth animation
        const scrollHeight = content.scrollHeight;
        content.style.maxHeight = scrollHeight + 'px';
    }
}

function collapseSection(btn) {
    const targetId = btn.getAttribute('data-target');
    const content = document.getElementById(targetId);
    
    if (content) {
        btn.classList.remove('expanded');
        content.classList.remove('expanded');
        content.style.maxHeight = '0px';
    }
}

// Progress Bar Animation
function initProgressBars() {
    const progressBars = document.querySelectorAll('.score-bar');
    
    // Animate progress bars with delay for better visual effect
    setTimeout(() => {
        progressBars.forEach(bar => {
            const score = parseInt(bar.getAttribute('data-score'));
            const percentage = score + '%';
            
            // Animate the width
            bar.style.width = percentage;
        });
    }, 500);
}

// Report Generation Functionality
function initReportGeneration() {
    const generateBtn = document.getElementById('generateReports');
    
    if (generateBtn) {
        generateBtn.addEventListener('click', function() {
            generateReports();
        });
    }
}

function generateReports() {
    const btn = document.getElementById('generateReports');
    const btnText = btn.querySelector('.btn-text');
    const loadingSpinner = btn.querySelector('.loading-spinner');
    
    // Show loading state
    btn.disabled = true;
    btnText.textContent = 'Generating Reports...';
    loadingSpinner.classList.remove('hidden');
    
    // Collect selected options
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    const commercialOptions = {
        costAnalysis: checkboxes[0] ? checkboxes[0].checked : false,
        roiCalculation: checkboxes[1] ? checkboxes[1].checked : false,
        executiveSummary: checkboxes[2] ? checkboxes[2].checked : false
    };
    
    const technicalOptions = {
        linkBudget: checkboxes[3] ? checkboxes[3].checked : false,
        equipmentSpecs: checkboxes[4] ? checkboxes[4].checked : false,
        installationGuide: checkboxes[5] ? checkboxes[5].checked : false
    };
    
    // Simulate report generation
    setTimeout(() => {
        // Reset button state
        btn.disabled = false;
        btnText.textContent = 'Generate Both Reports';
        loadingSpinner.classList.add('hidden');
        
        // Show success message
        showNotification('Reports generated successfully! Ready for download.', 'success');
        
        // Log report options for debugging
        console.log('Commercial Report Options:', commercialOptions);
        console.log('Technical Report Options:', technicalOptions);
        
        // Get selected kit info
        const selectedKit = getSelectedKitInfo();
        console.log('Selected Kit:', selectedKit);
        
    }, 3000);
}

// Kit Selection Functionality
function initKitSelection() {
    const selectBtns = document.querySelectorAll('.select-btn');
    
    selectBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            handleKitSelection(this);
        });
    });
}

function handleKitSelection(btn) {
    // Get kit information
    const kitCard = btn.closest('.kit-card');
    let kitName = 'Unknown Kit';
    let kitCost = 'N/A';
    
    if (kitCard.classList.contains('primary-card')) {
        kitName = 'KIT 3 - opción 3';
        kitCost = '$2,130';
    } else {
        const titleElement = kitCard.querySelector('.alt-kit-title');
        const costElement = kitCard.querySelector('.alt-cost');
        if (titleElement) {
            kitName = titleElement.textContent;
        }
        if (costElement) {
            kitCost = costElement.textContent;
        }
    }
    
    // Animate button
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        btn.style.transform = '';
    }, 150);
    
    // Show selection confirmation
    showNotification(`${kitName} selected! Cost: ${kitCost}`, 'info');
    
    // Update UI to reflect selection
    updateSelectedKit(kitName);
}

function updateSelectedKit(kitName) {
    // Remove previous selections
    document.querySelectorAll('.kit-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Add selection class to chosen kit
    document.querySelectorAll('.kit-card').forEach(card => {
        const title = card.querySelector('.kit-title, .alt-kit-title');
        if (title && title.textContent.includes(kitName.split(' - ')[0])) {
            card.classList.add('selected');
        }
    });
    
    // Store selection for report generation
    if (typeof(Storage) !== "undefined") {
        try {
            sessionStorage.setItem('selectedKit', kitName);
        } catch(e) {
            // Fallback if sessionStorage is not available
            console.log('Selected kit:', kitName);
        }
    }
}

function getSelectedKitInfo() {
    // Try to get from sessionStorage first
    if (typeof(Storage) !== "undefined") {
        try {
            const stored = sessionStorage.getItem('selectedKit');
            if (stored) return stored;
        } catch(e) {
            // Fallback
        }
    }
    
    // Find selected kit from DOM
    const selectedCard = document.querySelector('.kit-card.selected');
    if (selectedCard) {
        const title = selectedCard.querySelector('.kit-title, .alt-kit-title');
        return title ? title.textContent : 'KIT 3 - opción 3';
    }
    
    return 'KIT 3 - opción 3'; // Default to primary recommendation
}

// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-base);
        padding: var(--space-16);
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        max-width: 400px;
        opacity: 0;
        transform: translateX(100%);
        transition: all var(--duration-normal) var(--ease-standard);
        font-size: var(--font-size-base);
    `;
    
    // Add type-specific styling
    if (type === 'success') {
        notification.style.borderColor = '#22c55e';
        notification.style.background = 'var(--color-bg-3)';
    } else if (type === 'error') {
        notification.style.borderColor = '#ef4444';
        notification.style.background = 'var(--color-bg-4)';
    } else if (type === 'info') {
        notification.style.borderColor = '#3b82f6';
        notification.style.background = 'var(--color-bg-1)';
    }
    
    // Add notification content styles
    const content = notification.querySelector('.notification-content');
    content.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-12);
    `;
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: var(--font-size-xl);
        cursor: pointer;
        color: var(--color-text-secondary);
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Add close functionality
    closeBtn.addEventListener('click', () => {
        hideNotification(notification);
    });
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            hideNotification(notification);
        }
    }, 4000);
}

function hideNotification(notification) {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

// Animation and Enhancement Functions
function initAnimations() {
    // Add loading animation to cards on scroll
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
    
    // Observe all cards for animation
    const animatedElements = document.querySelectorAll('.kit-card, .metric-card, .report-card, .requirement-card');
    animatedElements.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(card);
    });
    
    // Add hover effects to interactive elements
    document.querySelectorAll('.metric-card, .report-card, .requirement-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            if (!this.style.transform.includes('translateY(-5px)')) {
                this.style.transform = this.style.transform.replace('translateY(0)', 'translateY(-5px)');
                this.style.boxShadow = 'var(--shadow-lg)';
            }
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = this.style.transform.replace('translateY(-5px)', 'translateY(0)');
            this.style.boxShadow = 'var(--shadow-sm)';
        });
    });
}

// Smooth scrolling for anchor links
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Utility function to format numbers
function formatNumber(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

// Function to calculate and display dynamic metrics
function updateDynamicMetrics() {
    // This could be used for real-time updates if connected to a backend
    const linkMargin = document.querySelector('.metric-value.excellent');
    if (linkMargin) {
        // Add small animation on update
        linkMargin.style.transform = 'scale(1.05)';
        setTimeout(() => {
            linkMargin.style.transform = 'scale(1)';
        }, 200);
    }
}

// Export functions for potential external use
window.RFKitSelector = {
    selectKit: updateSelectedKit,
    showNotification: showNotification,
    generateReports: generateReports,
    expandSection: expandSection,
    collapseSection: collapseSection,
    getSelectedKit: getSelectedKitInfo
};

// Add keyboard navigation support
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        // Close any open notifications
        const notification = document.querySelector('.notification');
        if (notification) {
            hideNotification(notification);
        }
    }
    
    if (e.key === 'Enter' && e.target.classList.contains('expand-btn')) {
        e.target.click();
    }
});

// Initialize smooth scrolling when DOM is ready
document.addEventListener('DOMContentLoaded', initSmoothScrolling);