// Smooth scroll reveal animations
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

// Apply animations to book cards and credential cards
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.book-card, .credential-card, .contact-card');
    
    animatedElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = `opacity 0.6s ease-out ${index * 0.1}s, transform 0.6s ease-out ${index * 0.1}s`;
        observer.observe(el);
    });
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if (target) {
            const navHeight = document.querySelector('.nav').offsetHeight;
            const targetPosition = target.offsetTop - navHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Add parallax effect to ink stains
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const inkStains = document.querySelectorAll('.ink-stain');
    
    inkStains.forEach((stain, index) => {
        const speed = 0.3 + (index * 0.1);
        stain.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// Add active state to navigation on scroll
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

window.addEventListener('scroll', () => {
    let current = '';
    const navHeight = document.querySelector('.nav').offsetHeight;
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop - navHeight - 100;
        const sectionHeight = section.offsetHeight;
        
        if (window.pageYOffset >= sectionTop && window.pageYOffset < sectionTop + sectionHeight) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.style.color = '';
        if (link.getAttribute('href') === `#${current}`) {
            link.style.color = 'var(--sage-dark)';
        }
    });
});

// Add hover effect enhancement for book cards
document.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transition = 'all 0.4s ease';
    });
});

// Typing effect for hero title (subtle enhancement)
const titleLines = document.querySelectorAll('.title-line');
let delay = 300;

titleLines.forEach((line, index) => {
    setTimeout(() => {
        line.style.opacity = '1';
    }, delay * index);
});


// =============================================================================
// Phase 3 — visitor analytics tracker
// All tracking is gated on window.sageTrackingAllowed() (set by the consent
// banner). If the visitor declines, this module is silent. If they accept
// after page load, the `sage:consent` event boots it on the spot.
// =============================================================================
(function () {
    var ENDPOINT = '/api/track';
    var booted   = false;

    function readSessionId() {
        try {
            var sid = sessionStorage.getItem('sage_sid');
            if (!sid) {
                sid = (crypto.randomUUID ? crypto.randomUUID()
                       : Math.random().toString(36).slice(2) + Date.now().toString(36));
                sessionStorage.setItem('sage_sid', sid);
            }
            return sid;
        } catch (e) {
            return 'no-storage-' + Math.random().toString(36).slice(2);
        }
    }

    function send(eventType, eventLabel) {
        if (!window.sageTrackingAllowed || !window.sageTrackingAllowed()) return;
        try {
            var payload = JSON.stringify({
                session_id  : readSessionId(),
                event_type  : eventType,
                event_label : eventLabel || null,
                page_path   : location.pathname + location.search,
                referrer    : document.referrer || null,
            });
            // sendBeacon survives page-unload (good for link_click on navigations).
            if (navigator.sendBeacon) {
                var blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon(ENDPOINT, blob);
            } else {
                fetch(ENDPOINT, {
                    method      : 'POST',
                    headers     : { 'content-type': 'application/json' },
                    body        : payload,
                    keepalive   : true,
                });
            }
        } catch (e) { /* swallow — tracking must never break the site */ }
    }

    function boot() {
        if (booted) return;
        booted = true;

        // Page view (one per page load).
        send('page_view');

        // Book card clicks. Use event delegation so the handler survives DOM updates.
        document.addEventListener('click', function (ev) {
            var card = ev.target.closest('.book-card');
            if (card) {
                var title = card.querySelector('.book-title');
                send('book_click', title ? title.textContent.trim() : 'unknown');
            }
            var link = ev.target.closest('a');
            if (!link) return;
            var href = link.getAttribute('href') || '';
            if (href.startsWith('mailto:')) {
                send('contact_click', href.replace('mailto:', ''));
            } else if (/amazon\./i.test(href)) {
                // Identify which book by the nearest book-title.
                var nearTitle = link.closest('.book-card');
                var label = nearTitle ? nearTitle.querySelector('.book-title').textContent.trim() : 'unknown';
                send('amazon_click', label);
            } else if (link.classList.contains('book-link')) {
                var t2 = link.closest('.book-card');
                send('link_click', t2 ? t2.querySelector('.book-title').textContent.trim() : 'link');
            }
        }, true);

        // About-section view (fires once when scrolled into view).
        var aboutEl = document.getElementById('about');
        if (aboutEl && 'IntersectionObserver' in window) {
            var aboutSeen = false;
            new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (e.isIntersecting && !aboutSeen) {
                        aboutSeen = true;
                        send('about_view');
                    }
                });
            }, { threshold: 0.4 }).observe(aboutEl);
        }

        // Scroll depth — 25 / 50 / 75 / 100 % milestones (each fires at most once).
        var milestones = [25, 50, 75, 100];
        var seen = {};
        var doc = document.documentElement;
        function onScroll() {
            var pct = Math.min(100, Math.round(
                ((window.pageYOffset + window.innerHeight) / doc.scrollHeight) * 100
            ));
            milestones.forEach(function (m) {
                if (pct >= m && !seen[m]) { seen[m] = true; send('scroll_depth', String(m)); }
            });
        }
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    // If consent was already granted (returning visitor), boot on DOM ready.
    document.addEventListener('DOMContentLoaded', function () {
        if (window.sageTrackingAllowed && window.sageTrackingAllowed()) boot();
    });

    // If the visitor accepts on this load, boot immediately + record the accept.
    document.addEventListener('sage:consent', function (ev) {
        if (ev.detail && ev.detail.value === 'accepted') {
            send('consent_accept');
            boot();
        }
        // If they decline, we send nothing (no event, no tracking) by design.
    });
})();
