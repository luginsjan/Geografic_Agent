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

// N8N Webhook URL constant
const n8nWebhookUrl = 'https://aigentinc.app.n8n.cloud/webhook-test/get-coordinates';

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

// Confirm Address Button Click Handler
if (confirmAddressButton) {
    confirmAddressButton.addEventListener('click', async () => {
        // Get the value from the textarea
        const clientAddressInput = document.querySelector('#client-address-input');
        const clientAddress = clientAddressInput.value.trim();
        
        // Validate input
        if (!clientAddress) {
            console.log('No address provided');
            return;
        }
        
        // Prepare the request data
        const requestData = {
            clientAddress: clientAddress
        };
        
        try {
            console.log('Sending address data to n8n webhook:', requestData);
            
            // Send POST request to n8n webhook
            const response = await fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            // Check if the request was successful
            if (response.ok) {
                console.log('Successfully sent address data to n8n webhook');
                const responseData = await response.json();
                console.log('Response from webhook:', responseData);
            } else {
                console.error('Failed to send data to n8n webhook. Status:', response.status);
                const errorText = await response.text();
                console.error('Error response:', errorText);
            }
            
        } catch (error) {
            console.error('Error sending data to n8n webhook:', error);
        } finally {
            // Always trigger the smooth closing of the form block
            console.log('Closing form block after webhook request');
            
            // Smoothly minimize the form block
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
                    
                    // Smoothly re-open the form block
                    clientCoordinatesFormBlock.classList.remove('minimized');
                    
                    // Hide the edit button
                    editButton.classList.remove('visible');
                    
                    // Remove the button after animation completes
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
                
            }, 600); // Wait for minimize animation to complete
        }
    });
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