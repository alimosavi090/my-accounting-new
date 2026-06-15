// components/search.js

const GlobalSearch = {
    init() {
        const overlay = document.getElementById('searchOverlay');
        const searchInput = document.getElementById('searchModalInput');
        const resultsBox = document.getElementById('searchResults');
        
        // Open search with shortcut (Ctrl+K or Cmd+K)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                overlay.classList.add('open');
                searchInput.focus();
            }
            if (e.key === 'Escape' && overlay.classList.contains('open')) {
                overlay.classList.remove('open');
            }
        });

        // Open search via sidebar box
        const sidebarBox = document.getElementById('globalSearchBox');
        if (sidebarBox) {
            sidebarBox.addEventListener('click', () => {
                overlay.classList.add('open');
                searchInput.focus();
            });
        }

        // Close on outside click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('open');
            }
        });

        // Search logic with debounce
        let timeout = null;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                resultsBox.innerHTML = '<div class="search-empty">عبارت مورد نظر را تایپ کنید (حداقل ۲ حرف)</div>';
                return;
            }

            timeout = setTimeout(async () => {
                resultsBox.innerHTML = '<div class="search-empty"><span class="spinner" style="width:20px;height:20px;margin:0 auto"></span></div>';
                
                try {
                    const data = await Utils.api(`/search?q=${encodeURIComponent(query)}`);
                    this.renderResults(data, resultsBox);
                } catch(err) {
                    resultsBox.innerHTML = '<div class="search-empty">خطا در جستجو</div>';
                }
            }, 500);
        });
    },

    renderResults(data, container) {
        let html = '';
        let hasResults = false;

        if (data.resellers && data.resellers.length > 0) {
            hasResults = true;
            html += `<div class="search-group-title">نمایندگان</div>`;
            data.resellers.forEach(r => {
                html += `
                    <div class="search-result-item" onclick="window.location.hash='#resellers'; document.getElementById('searchOverlay').classList.remove('open'); setTimeout(()=>window.dispatchEvent(new CustomEvent('openReseller', {detail:${r.id}})), 100)">
                        <div>
                            <div class="s-title">${r.full_name}</div>
                            <div class="s-desc">${r.mobile || r.telegram_id || ''}</div>
                        </div>
                        <div class="badge ${r.status === 'active' ? 'success' : 'danger'}">نماینده</div>
                    </div>
                `;
            });
        }

        if (data.transactions && data.transactions.length > 0) {
            hasResults = true;
            html += `<div class="search-group-title">تراکنش‌ها</div>`;
            data.transactions.forEach(t => {
                html += `
                    <div class="search-result-item" onclick="window.location.hash='#transactions'; document.getElementById('searchOverlay').classList.remove('open');">
                        <div>
                            <div class="s-title">${t.description}</div>
                            <div class="s-desc">${t.tx_number} • ${Utils.formatDate(t.date)}</div>
                        </div>
                        <div class="fw-bold ltr ${t.type === 'expense' || t.type === 'settlement' ? 'text-red' : 'text-cyan'}">
                            ${Utils.formatMoney(t.amount)}
                        </div>
                    </div>
                `;
            });
        }

        if (data.expenses && data.expenses.length > 0) {
            hasResults = true;
            html += `<div class="search-group-title">هزینه‌ها</div>`;
            data.expenses.forEach(e => {
                html += `
                    <div class="search-result-item" onclick="window.location.hash='#expenses'; document.getElementById('searchOverlay').classList.remove('open');">
                        <div>
                            <div class="s-title">${e.title}</div>
                            <div class="s-desc">${e.provider || ''}</div>
                        </div>
                        <div class="fw-bold ltr text-red">${Utils.formatMoney(e.amount)}</div>
                    </div>
                `;
            });
        }

        if (!hasResults) {
            html = '<div class="search-empty">نتیجه‌ای یافت نشد</div>';
        }

        container.innerHTML = html;
    }
};
