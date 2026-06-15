// dashboard.js

window.DashboardPage = {
    container: null,
    charts: [],
    updateInterval: null,

    async render(container) {
        this.container = container;
        this.destroy(); // Clean up previous charts if any
        
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-wrap">
                    <h2>داشبورد مدیریتی</h2>
                    <p>نمای کلی وضعیت مالی و عملکرد کسب‌وکار</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-ghost" id="btnRefreshDash">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"></path></svg>
                        بروزرسانی
                    </button>
                    <button class="btn btn-primary" onclick="window.location.hash='#revenues'">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        ثبت درآمد
                    </button>
                </div>
            </div>

            <!-- Alerts Section -->
            <div id="dashAlerts" style="margin-bottom: 24px; display: flex; flex-direction: column; gap: 12px;"></div>

            <!-- KPI Cards -->
            <div class="kpi-grid">
                <div class="kpi-card blue">
                    <div class="kpi-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path></svg>
                    </div>
                    <div class="kpi-label">موجودی کل بانک‌ها</div>
                    <div class="kpi-value counter-up" id="kpiTotalBank">۰</div>
                </div>
                <div class="kpi-card cyan">
                    <div class="kpi-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                    </div>
                    <div class="kpi-label">سود خالص (کل)</div>
                    <div class="kpi-value counter-up" id="kpiNetProfit">۰</div>
                </div>
                <div class="kpi-card cyan">
                    <div class="kpi-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    </div>
                    <div class="kpi-label">درآمد امروز</div>
                    <div class="kpi-value counter-up" id="kpiTodayRev">۰</div>
                </div>
                <div class="kpi-card red">
                    <div class="kpi-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
                    </div>
                    <div class="kpi-label">هزینه امروز</div>
                    <div class="kpi-value counter-up" id="kpiTodayExp">۰</div>
                </div>
            </div>

            <!-- Reseller Financials & Bank Overview -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 32px;">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">وضعیت مالی نمایندگان</h3>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="padding: 16px; background: var(--bg-card-hover); border-radius: var(--radius-sm); border: 1px solid rgba(239, 71, 111, 0.2);">
                            <div class="text-muted mb-1 font-size-12 fw-bold">کل بدهی (طلب ما)</div>
                            <div class="text-red fw-bold text-lg ltr" id="resTotalDebt" style="font-size: 20px;">۰</div>
                            <div class="text-muted mt-1 font-size-11" id="resDebtorCount">۰ نماینده بدهکار</div>
                        </div>
                        <div style="padding: 16px; background: var(--bg-card-hover); border-radius: var(--radius-sm); border: 1px solid rgba(6, 214, 160, 0.2);">
                            <div class="text-muted mb-1 font-size-12 fw-bold">کل بستانکاری (بدهی ما)</div>
                            <div class="text-cyan fw-bold text-lg ltr" id="resTotalCredit" style="font-size: 20px;">۰</div>
                            <div class="text-muted mt-1 font-size-11" id="resCreditorCount">۰ نماینده بستانکار</div>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">جریان نقدینگی ماهانه</h3>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; text-align: center;">
                        <div>
                            <div class="text-muted mb-1 font-size-12 fw-bold">ورودی بانک</div>
                            <div class="text-cyan fw-bold ltr" id="bankIncoming">۰</div>
                        </div>
                        <div style="border-right: 1px solid var(--border); border-left: 1px solid var(--border);">
                            <div class="text-muted mb-1 font-size-12 fw-bold">خروجی بانک</div>
                            <div class="text-red fw-bold ltr" id="bankOutgoing">۰</div>
                        </div>
                        <div>
                            <div class="text-muted mb-1 font-size-12 fw-bold">جریان خالص</div>
                            <div class="fw-bold ltr" id="bankNetFlow">۰</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Charts Area 1 -->
            <div class="charts-grid">
                <div class="chart-card">
                    <div class="card-header">
                        <h3 class="card-title">روند درآمد (۳۰ روز گذشته)</h3>
                    </div>
                    <div style="height: 250px; position: relative;">
                        <canvas id="chartRevenueTrend"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <div class="card-header">
                        <h3 class="card-title">سود و زیان ۶ ماهه</h3>
                    </div>
                    <div style="height: 250px; position: relative;">
                        <canvas id="chartMonthlyPerf"></canvas>
                    </div>
                </div>
            </div>

            <!-- Charts Area 2 -->
            <div class="charts-grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
                <div class="chart-card">
                    <div class="card-header">
                        <h3 class="card-title">تفکیک منابع درآمد</h3>
                    </div>
                    <div style="height: 220px; position: relative;">
                        <canvas id="chartRevSource"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <div class="card-header">
                        <h3 class="card-title">تفکیک هزینه‌ها</h3>
                    </div>
                    <div style="height: 220px; position: relative;">
                        <canvas id="chartExpCategory"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <div class="card-header">
                        <h3 class="card-title">نمایندگان برتر (فروش)</h3>
                    </div>
                    <div id="topResellersList" style="display: flex; flex-direction: column; gap: 8px;">
                        <div class="skeleton" style="height: 48px;"></div>
                        <div class="skeleton" style="height: 48px;"></div>
                        <div class="skeleton" style="height: 48px;"></div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btnRefreshDash').addEventListener('click', () => this.loadData());
        
        await this.loadData();

        // Auto refresh every 5 minutes
        this.updateInterval = setInterval(() => this.loadData(), 5 * 60 * 1000);
    },

    async loadData() {
        try {
            // Fetch all dashboard data concurrently
            const [summary, resStatus, bankOverview, chartsData, topResellers, alerts] = await Promise.all([
                Utils.api('/dashboard/summary'),
                Utils.api('/dashboard/reseller-status'),
                Utils.api('/dashboard/bank-overview'),
                Utils.api('/dashboard/charts'),
                Utils.api('/dashboard/top-resellers'),
                Utils.api('/dashboard/alerts')
            ]);

            this.renderSummary(summary);
            this.renderResellerStatus(resStatus);
            this.renderBankOverview(bankOverview);
            this.renderAlerts(alerts);
            this.renderTopResellers(topResellers);
            this.renderCharts(chartsData);

        } catch (err) {
            console.error('Failed to load dashboard data', err);
        }
    },

    renderSummary(data) {
        document.getElementById('kpiTotalBank').textContent = Utils.formatMoney(data.total_bank_balance);
        document.getElementById('kpiNetProfit').textContent = Utils.formatMoney(data.net_profit);
        document.getElementById('kpiTodayRev').textContent = Utils.formatMoney(data.today_revenue);
        document.getElementById('kpiTodayExp').textContent = Utils.formatMoney(data.today_expenses);
    },

    renderResellerStatus(data) {
        document.getElementById('resTotalDebt').textContent = Utils.formatMoney(data.total_debt);
        document.getElementById('resDebtorCount').textContent = Utils.toPersianNum(data.debtor_count) + ' بدهکار';
        document.getElementById('resTotalCredit').textContent = Utils.formatMoney(data.total_credit);
        document.getElementById('resCreditorCount').textContent = Utils.toPersianNum(data.creditor_count) + ' بستانکار';
    },

    renderBankOverview(data) {
        document.getElementById('bankIncoming').textContent = Utils.formatMoney(data.incoming);
        document.getElementById('bankOutgoing').textContent = Utils.formatMoney(data.outgoing);
        const netFlowEl = document.getElementById('bankNetFlow');
        netFlowEl.textContent = Utils.formatMoney(data.net_flow);
        netFlowEl.className = `fw-bold ltr ${data.net_flow >= 0 ? 'text-cyan' : 'text-red'}`;
    },

    renderAlerts(alerts) {
        const container = document.getElementById('dashAlerts');
        if (!alerts || alerts.length === 0) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        alerts.forEach(alert => {
            const colorClass = alert.level === 'danger' ? 'danger' : (alert.level === 'warning' ? 'warning' : 'info');
            const icon = alert.level === 'danger' ? '⚠️' : '🔔';
            
            html += `
                <div style="background: rgba(${alert.level === 'danger' ? '239,71,111' : '255,209,102'}, 0.1); border: 1px solid rgba(${alert.level === 'danger' ? '239,71,111' : '255,209,102'}, 0.3); padding: 12px 16px; border-radius: var(--radius-sm); display: flex; gap: 12px; align-items: center;">
                    <div style="font-size: 20px;">${icon}</div>
                    <div>
                        <div class="fw-bold text-${colorClass}">${alert.title}</div>
                        <div style="font-size: 12px; color: var(--text-2); margin-top: 4px;">${alert.message}</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    renderTopResellers(data) {
        const container = document.getElementById('topResellersList');
        if (!data.top_sellers || data.top_sellers.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding: 20px;">اطلاعاتی موجود نیست</div>';
            return;
        }

        let html = '';
        data.top_sellers.forEach((s, idx) => {
            const medals = ['🥇', '🥈', '🥉', '۴', '۵'];
            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--bg-card-hover); border-radius: var(--radius-sm);">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--bg-card); display: flex; align-items: center; justify-content: center; font-size: 12px;">${medals[idx] || idx+1}</div>
                        <div class="fw-bold font-size-13">${s.full_name}</div>
                    </div>
                    <div class="fw-bold text-cyan ltr">${Utils.formatMoney(s.total)}</div>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    renderCharts(data) {
        this.destroy(); // Clear old charts

        // 1. Revenue Trend
        if (data.revenue_trend) {
            const labels = data.revenue_trend.map(d => Utils.formatDate(d.date));
            const values = data.revenue_trend.map(d => d.amount);
            const chart = createTrendChart('chartRevenueTrend', 'درآمد', labels, values, '--cyan');
            if (chart) this.charts.push(chart);
        }

        // 2. Monthly Performance (Bar chart)
        if (data.monthly_performance && document.getElementById('chartMonthlyPerf')) {
            const ctx = document.getElementById('chartMonthlyPerf');
            
            // Reverse to show oldest to newest (left to right)
            const sortedData = [...data.monthly_performance].reverse();
            
            const labels = sortedData.map(d => d.month);
            const revValues = sortedData.map(d => d.revenue);
            const expValues = sortedData.map(d => d.expenses);
            
            const computedStyle = getComputedStyle(document.body);
            const cyan = computedStyle.getPropertyValue('--cyan').trim();
            const red = computedStyle.getPropertyValue('--red').trim();

            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels.map(l => Utils.toPersianNum(l)),
                    datasets: [
                        {
                            label: 'درآمد',
                            data: revValues,
                            backgroundColor: cyan,
                            borderRadius: 4
                        },
                        {
                            label: 'هزینه',
                            data: expValues,
                            backgroundColor: red,
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', rtl: true, labels: { font: { family: "'Vazirmatn'" } } } },
                    scales: {
                        x: { grid: { display: false } },
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { callback: function(v) { return Utils.toPersianNum(v >= 1000000 ? (v/1000000)+'m' : v); } }
                        }
                    }
                }
            });
            this.charts.push(chart);
        }

        // 3. Revenue Source Donut
        if (data.revenue_by_source && data.revenue_by_source.length > 0) {
            const sources = { 'zarinpal': 'زرین‌پال', 'card_to_card': 'کارت به کارت', 'manual': 'دستی' };
            const labels = data.revenue_by_source.map(d => sources[d.source] || d.source);
            const values = data.revenue_by_source.map(d => d.total);
            const chart = createDonutChart('chartRevSource', labels, values, ['--cyan', '--blue', '--purple']);
            if (chart) this.charts.push(chart);
        }

        // 4. Expense Category Donut
        if (data.expense_by_category && data.expense_by_category.length > 0) {
            const labels = data.expense_by_category.map(d => d.category);
            const values = data.expense_by_category.map(d => d.total);
            const colors = ['--red', '--orange', '--yellow', '--purple', '--blue', '--teal'];
            const chart = createDonutChart('chartExpCategory', labels, values, colors);
            if (chart) this.charts.push(chart);
        }
    },

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.charts.forEach(c => c.destroy());
        this.charts = [];
    }
};
