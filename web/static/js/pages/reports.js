// reports.js

window.ReportsPage = {
    container: null,
    
    async render(container) {
        this.container = container;
        
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-wrap">
                    <h2>گزارشات مدیریتی</h2>
                    <p>گزارش سود و زیان، تحلیل هزینه‌ها و بیلان کاری</p>
                </div>
            </div>

            <div class="tabs" id="reportTabs">
                <button class="tab active" data-report="profit">گزارش سود و زیان (P&L)</button>
                <button class="tab" data-report="expenses">تحلیل هزینه‌ها</button>
            </div>

            <div id="reportContent"></div>
        `;

        document.querySelectorAll('#reportTabs .tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('#reportTabs .tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.loadReport(e.target.dataset.report);
            });
        });

        await this.loadReport('profit');
    },

    async loadReport(type) {
        const content = document.getElementById('reportContent');
        content.innerHTML = `
            <div style="display:flex; justify-content:center; padding:100px;">
                <span class="spinner" style="width:40px; height:40px; border-width:4px;"></span>
            </div>
        `;

        try {
            if (type === 'profit') {
                const data = await Utils.api('/reports/profit-loss');
                this.renderProfitLoss(data);
            } else if (type === 'expenses') {
                const data = await Utils.api('/reports/expense-analysis');
                this.renderExpenseAnalysis(data);
            }
        } catch(e) {
            content.innerHTML = '<div class="empty-state">خطا در دریافت اطلاعات</div>';
        }
    },

    renderProfitLoss(data) {
        let html = `
            <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
                <div class="kpi-card cyan">
                    <div class="text-muted font-size-12 fw-bold mb-2">درآمد ناخالص کل</div>
                    <div class="kpi-value">${Utils.formatMoney(data.gross_revenue)}</div>
                </div>
                <div class="kpi-card red">
                    <div class="text-muted font-size-12 fw-bold mb-2">هزینه‌های کل</div>
                    <div class="kpi-value">${Utils.formatMoney(data.total_expenses)}</div>
                </div>
                <div class="kpi-card ${data.net_profit >= 0 ? 'blue' : 'orange'}">
                    <div class="text-muted font-size-12 fw-bold mb-2">سود / زیان خالص</div>
                    <div class="kpi-value">${Utils.formatMoney(data.net_profit)}</div>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-card">
                    <h3 class="card-title mb-4">روند ماهانه سودآوری</h3>
                    <div style="height: 300px;"><canvas id="chartPlTrend"></canvas></div>
                </div>
                <div class="card">
                    <h3 class="card-title mb-4">تفکیک درآمدها</h3>
                    <div class="table-container">
                        <table class="data-table">
                            <thead><tr><th>منبع</th><th>مبلغ کل (تومان)</th><th>سهم</th></tr></thead>
                            <tbody>
        `;

        data.revenue_breakdown.forEach(r => {
            const pct = data.gross_revenue > 0 ? (r.total / data.gross_revenue * 100).toFixed(1) : 0;
            const sourceMap = { 'zarinpal': 'زرین‌پال', 'card_to_card': 'کارت به کارت', 'manual': 'دستی' };
            html += `
                <tr>
                    <td>${sourceMap[r.source] || r.source}</td>
                    <td class="ltr fw-bold text-cyan">${Utils.formatMoney(r.total)}</td>
                    <td class="ltr">${Utils.toPersianNum(pct)}%</td>
                </tr>
            `;
        });

        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('reportContent').innerHTML = html;

        // Render Chart
        if (data.profit_trend && data.profit_trend.length > 0) {
            const sorted = [...data.profit_trend].reverse();
            const labels = sorted.map(d => d.month);
            const values = sorted.map(d => d.profit);
            
            const ctx = document.getElementById('chartPlTrend');
            
            const bgColors = values.map(v => v >= 0 ? 'rgba(6, 214, 160, 0.5)' : 'rgba(239, 71, 111, 0.5)');
            const borderColors = values.map(v => v >= 0 ? 'rgb(6, 214, 160)' : 'rgb(239, 71, 111)');

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'سود/زیان',
                        data: values,
                        backgroundColor: bgColors,
                        borderColor: borderColors,
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false } },
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { callback: function(v) { return Utils.toPersianNum(v >= 1000000 ? (v/1000000)+'m' : v); } }
                        }
                    }
                }
            });
        }
    },

    renderExpenseAnalysis(data) {
        let html = `
            <div class="charts-grid">
                <div class="chart-card">
                    <h3 class="card-title mb-4">هزینه‌ها بر اساس دسته‌بندی</h3>
                    <div style="height: 300px;"><canvas id="chartExpBreakdown"></canvas></div>
                </div>
                <div class="card">
                    <h3 class="card-title mb-4">جزئیات دسته‌بندی‌ها</h3>
                    <div class="table-container">
                        <table class="data-table">
                            <thead><tr><th>دسته‌بندی</th><th>تعداد</th><th>مبلغ کل (تومان)</th></tr></thead>
                            <tbody>
        `;

        let totalExp = 0;
        data.by_category.forEach(c => totalExp += c.total);

        data.by_category.forEach(c => {
            html += `
                <tr>
                    <td class="fw-bold">${c.category}</td>
                    <td>${Utils.toPersianNum(c.count)}</td>
                    <td class="ltr fw-bold text-red">${Utils.formatMoney(c.total)}</td>
                </tr>
            `;
        });

        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('reportContent').innerHTML = html;

        if (data.by_category && data.by_category.length > 0) {
            const labels = data.by_category.map(d => d.category);
            const values = data.by_category.map(d => d.total);
            const colors = ['--red', '--orange', '--yellow', '--purple', '--blue', '--teal'];
            createDonutChart('chartExpBreakdown', labels, values, colors);
        }
    },

    async loadBankReport(bankId) {
        document.querySelectorAll('#reportTabs .tab').forEach(t => t.classList.remove('active'));
        
        const content = document.getElementById('reportContent');
        content.innerHTML = `
            <div style="display:flex; justify-content:center; padding:100px;">
                <span class="spinner" style="width:40px; height:40px; border-width:4px;"></span>
            </div>
        `;

        try {
            const data = await Utils.api(`/reports/bank/${bankId}`);
            
            let html = `
                <div class="card mb-4" style="background: linear-gradient(145deg, var(--bg-card), var(--bg-card-hover)); border-top: 4px solid ${data.bank.color || 'var(--cyan)'}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 24px;">
                        <div>
                            <h3 style="font-size: 20px; margin-bottom: 8px;">گزارش حساب: ${data.bank.title}</h3>
                            <div class="text-muted">${data.bank.bank_name || ''} • ${data.bank.account_number || ''}</div>
                        </div>
                        <div class="text-left">
                            <div class="text-muted font-size-12 mb-1">موجودی فعلی</div>
                            <div class="font-size-28 fw-bold ltr text-cyan">${Utils.formatMoney(data.bank.balance)}</div>
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div style="background:var(--bg-input); padding:16px; border-radius:var(--radius-sm)">
                            <div class="text-muted font-size-12 mb-1">مجموع واریزی‌ها (کل دوره)</div>
                            <div class="font-size-18 fw-bold ltr text-cyan">+${Utils.formatMoney(data.total_deposits)}</div>
                        </div>
                        <div style="background:var(--bg-input); padding:16px; border-radius:var(--radius-sm)">
                            <div class="text-muted font-size-12 mb-1">مجموع برداشت‌ها (کل دوره)</div>
                            <div class="font-size-18 fw-bold ltr text-red">-${Utils.formatMoney(data.total_withdrawals)}</div>
                        </div>
                    </div>
                </div>

                <h3 class="mb-4">تراکنش‌های اخیر حساب</h3>
                <div class="table-container">
                    <table class="data-table">
                        <thead><tr><th>تاریخ</th><th>شرح</th><th>مبلغ (تومان)</th><th>موجودی</th></tr></thead>
                        <tbody>
            `;

            let runningBalance = data.bank.balance;
            
            data.transactions.forEach(t => {
                const isDeposit = t.type === 'revenue' || t.type === 'bank_deposit' || t.type === 'settlement';
                
                html += `
                    <tr>
                        <td class="ltr">${Utils.formatDate(t.date, true)}</td>
                        <td>${t.description} <br><span class="badge" style="font-size:10px; margin-top:4px;">${t.tx_number}</span></td>
                        <td class="ltr fw-bold ${isDeposit ? 'text-cyan' : 'text-red'}">${isDeposit ? '+' : '-'}${Utils.formatMoney(t.amount)}</td>
                        <td class="ltr font-mono text-muted">-</td>
                    </tr>
                `;
            });

            html += `</tbody></table></div>`;
            content.innerHTML = html;

        } catch(e) {
            content.innerHTML = '<div class="empty-state">خطا در دریافت اطلاعات حساب</div>';
        }
    }
};
