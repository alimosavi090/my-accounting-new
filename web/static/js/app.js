// app.js

const App = {
    pages: {
        dashboard: window.DashboardPage,
        revenues: window.RevenuesPage,
        expenses: window.ExpensesPage,
        banks: window.BanksPage,
        resellers: window.ResellersPage,
        settlements: window.SettlementsPage,
        transactions: window.TransactionsPage,
        reports: window.ReportsPage
    },
    
    currentPage: null,

    init() {
        // Auth check before anything
        const token = localStorage.getItem('vpn_token');
        if (!token && window.location.pathname !== '/login.html') {
            window.location.href = '/login.html';
            return;
        }

        this.initTheme();
        this.initSidebar();
        this.initRouter();
        this.initLogout();
        
        // Initialize Global Search if exists
        if (window.GlobalSearch) {
            window.GlobalSearch.init();
        }

        // Listen for internal navigation events
        window.addEventListener('openReseller', (e) => {
            if (window.ResellerDetailPage) {
                this.loadPage('reseller-detail', { id: e.detail });
            }
        });
    },

    initTheme() {
        const toggleBtns = document.querySelectorAll('.theme-toggle, .theme-toggle-mobile');
        const root = document.documentElement;
        const body = document.body;
        
        // Load saved theme
        const savedTheme = localStorage.getItem('vpn_theme') || 'dark';
        body.setAttribute('data-theme', savedTheme);
        
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const current = body.getAttribute('data-theme');
                const next = current === 'dark' ? 'light' : 'dark';
                
                body.setAttribute('data-theme', next);
                localStorage.setItem('vpn_theme', next);
                
                // If there are any charts on the page, they need to be re-rendered
                // because Chart.js doesn't automatically update colors based on CSS vars
                if (this.currentPage && this.currentPage.render) {
                    setTimeout(() => this.currentPage.render(), 100);
                }
            });
        });
    },

    initSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const menuToggle = document.getElementById('menuToggle');
        const sidebarClose = document.getElementById('sidebarClose');
        
        const openSidebar = () => {
            sidebar.classList.add('open');
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
        };
        
        const closeSidebar = () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        };

        if (menuToggle) menuToggle.addEventListener('click', openSidebar);
        if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
        if (overlay) overlay.addEventListener('click', closeSidebar);

        // Handle active states
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                if (window.innerWidth <= 1024) closeSidebar();
            });
        });
    },

    initRouter() {
        const handleRoute = () => {
            let hash = window.location.hash.slice(1);
            if (!hash) {
                hash = 'dashboard';
                window.location.hash = hash;
                return;
            }

            // Update sidebar active state
            document.querySelectorAll('.nav-item').forEach(nav => {
                if (nav.getAttribute('data-page') === hash) {
                    nav.classList.add('active');
                } else {
                    nav.classList.remove('active');
                }
            });

            this.loadPage(hash);
        };

        window.addEventListener('hashchange', handleRoute);
        handleRoute(); // Load initial
    },

    async loadPage(pageName, params = null) {
        const mainContent = document.getElementById('mainContent');
        
        // Show loading state
        mainContent.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 50vh;">
                <div class="spinner"></div>
            </div>
        `;

        try {
            // Clean up previous page
            if (this.currentPage && this.currentPage.destroy) {
                this.currentPage.destroy();
            }

            let pageObj = null;

            // Handle special routing
            if (pageName === 'reseller-detail') {
                pageObj = window.ResellerDetailPage;
            } else {
                pageObj = this.pages[pageName];
            }

            if (!pageObj) {
                throw new Error(`Page ${pageName} not found`);
            }

            this.currentPage = pageObj;
            await pageObj.render(mainContent, params);

        } catch (err) {
            console.error('Page load error:', err);
            mainContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <h3>خطا در بارگذاری صفحه</h3>
                    <p>${err.message}</p>
                    <button class="btn btn-primary mt-2" onclick="window.location.hash='#dashboard'">بازگشت به داشبورد</button>
                </div>
            `;
        }
    },

    initLogout() {
        const footerInfo = document.querySelector('.sidebar-footer-info');
        if (footerInfo) {
            const user = JSON.parse(localStorage.getItem('vpn_user') || '{}');
            footerInfo.innerHTML = `
                <button class="btn btn-ghost" style="padding: 4px; border:none;" onclick="App.logout()" title="خروج از حساب">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </button>
                <span>${user.username || 'مدیر'}</span>
            `;
        }
    },

    logout() {
        localStorage.removeItem('vpn_token');
        localStorage.removeItem('vpn_user');
        window.location.href = '/login.html';
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
