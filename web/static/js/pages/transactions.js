// transactions.js

window.TransactionsPage = {
    container: null,
    table: null,
    
    async render(container) {
        this.container = container;
        
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-wrap">
                    <h2>دفتر کل تراکنش‌ها (Audit)</h2>
                    <p>تاریخچه تمامی تراکنش‌های مالی، انتقالات و گردش‌های سیستم</p>
                </div>
            </div>

            <div class="card mb-4" style="padding: 16px;">
                <div class="table-toolbar">
                    <div class="table-filters" id="txFilters">
                        <select class="form-input" id="filterType" style="width: 150px;">
                            <option value="">همه انواع</option>
                            <option value="revenue">درآمدها</option>
                            <option value="expense">هزینه‌ها</option>
                            <option value="settlement">تسویه‌حساب‌ها</option>
                            <option value="bank_deposit">واریز بانک</option>
                            <option value="bank_withdraw">برداشت بانک</option>
                            <option value="bank_transfer">انتقال بین بانکی</option>
                        </select>
                        <input type="text" id="filterSearch" class="form-input" placeholder="جستجو..." style="width: 250px;">
                    </div>
                    <button class="btn btn-ghost" onclick="window.TransactionsPage.loadData()">اعمال فیلتر</button>
                </div>
            </div>

            <div id="tableContainer"></div>
        `;

        this.table = new TableBuilder('tableContainer')
            .setColumns([
                { key: 'tx_number', label: 'شماره سند', render: (val) => `<span class="font-mono ltr text-muted">${val}</span>` },
                { key: 'date', label: 'تاریخ و زمان', render: (val) => `<span class="ltr">${Utils.formatDate(val, true)}</span>` },
                { key: 'type', label: 'نوع تراکنش', render: (val) => {
                    const map = {
                        'revenue': '<span class="badge success">درآمد</span>',
                        'expense': '<span class="badge danger">هزینه</span>',
                        'settlement': '<span class="badge purple">تسویه حساب</span>',
                        'bank_deposit': '<span class="badge cyan">واریز به بانک</span>',
                        'bank_withdraw': '<span class="badge warning">برداشت از بانک</span>',
                        'bank_transfer': '<span class="badge info">انتقال بانکی</span>'
                    };
                    return map[val] || val;
                }},
                { key: 'amount', label: 'مبلغ (تومان)', render: (val, row) => {
                    const isCredit = row.type === 'revenue' || row.type === 'bank_deposit' || row.type === 'settlement';
                    return `<span class="fw-bold ltr ${isCredit ? 'text-cyan' : 'text-red'}">${Utils.formatMoney(val)}</span>`;
                }},
                { key: 'description', label: 'شرح تراکنش', render: (val, row) => `
                    <div>${val}</div>
                    <div class="font-size-11 text-muted mt-1">
                        ${row.BankAccount ? `حساب: ${row.BankAccount.title}` : ''}
                        ${row.Reseller ? ` | نماینده: ${row.Reseller.full_name}` : ''}
                    </div>
                `}
            ])
            .setActions((row) => `
                <button class="btn-icon" title="مشاهده جزئیات حسابداری (سند دوبل)" onclick="window.TransactionsPage.showDetails(${row.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </button>
            `);

        document.getElementById('filterSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.loadData();
        });

        this.table.renderSkeleton();
        await this.loadData();
    },

    async loadData() {
        try {
            const type = document.getElementById('filterType').value;
            const search = document.getElementById('filterSearch').value;
            
            let url = '/transactions?limit=100';
            if (type) url += `&type=${type}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;

            const res = await Utils.api(url);
            this.table.setData(res.data).render();
        } catch (err) {}
    },

    async showDetails(id) {
        try {
            const data = await Utils.api(`/transactions/${id}`);
            const tx = data.transaction;
            const entries = data.entries || [];

            let html = `
                <div style="background:var(--bg-input); padding:16px; border-radius:var(--radius-sm); margin-bottom:20px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                        <div>
                            <div class="text-muted font-size-11 mb-1">شماره سند</div>
                            <div class="fw-bold font-mono ltr">${tx.tx_number}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-muted font-size-11 mb-1">تاریخ</div>
                            <div class="fw-bold ltr">${Utils.formatDate(tx.date, true)}</div>
                        </div>
                    </div>
                    <div class="fw-bold mb-2">${tx.description}</div>
                </div>

                <h4 class="mb-2 font-size-14">آرتیکل‌های حسابداری (سند دوبل)</h4>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>کد حساب</th>
                                <th>شرح</th>
                                <th>بدهکار</th>
                                <th>بستانکار</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            let totalDebit = 0;
            let totalCredit = 0;

            entries.forEach(e => {
                totalDebit += e.debit_amount;
                totalCredit += e.credit_amount;
                html += `
                    <tr>
                        <td class="font-mono text-muted">${e.account_type}-${e.account_id}</td>
                        <td>${e.description}</td>
                        <td class="text-red ltr">${e.debit_amount > 0 ? Utils.formatMoney(e.debit_amount) : ''}</td>
                        <td class="text-cyan ltr">${e.credit_amount > 0 ? Utils.formatMoney(e.credit_amount) : ''}</td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                        <tfoot style="background: var(--bg-secondary); font-weight: bold;">
                            <tr>
                                <td colspan="2" class="text-left">جمع تراز:</td>
                                <td class="text-red ltr">${Utils.formatMoney(totalDebit)}</td>
                                <td class="text-cyan ltr">${Utils.formatMoney(totalCredit)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;

            Modal.open({
                title: 'جزئیات تراکنش مالی',
                body: html,
                footer: `<button type="button" class="btn btn-ghost" data-dismiss="modal">بستن</button>`
            });

        } catch(e) {}
    }
};
