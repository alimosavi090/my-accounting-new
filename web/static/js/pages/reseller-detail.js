// reseller-detail.js

window.ResellerDetailPage = {
    container: null,
    resellerId: null,
    table: null,
    
    async render(container, params) {
        if (!params || !params.id) {
            window.location.hash = '#resellers';
            return;
        }

        this.container = container;
        this.resellerId = params.id;
        
        container.innerHTML = `
            <div class="mb-4">
                <button class="btn btn-ghost" onclick="window.location.hash='#resellers'">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    بازگشت به لیست نمایندگان
                </button>
            </div>

            <div id="profileHeader">
                <div class="skeleton" style="height: 150px; border-radius: var(--radius); margin-bottom: 24px;"></div>
            </div>

            <div class="page-header" style="margin-top: 32px;">
                <div class="page-title-wrap">
                    <h3>دفتر کل (Ledger)</h3>
                </div>
                <div class="page-actions">
                    <button class="btn btn-ghost" onclick="window.ResellerDetailPage.showAdjustModal()">
                        تعدیل حساب
                    </button>
                    <button class="btn btn-primary" onclick="window.ResellerDetailPage.showSaleModal()">
                        ثبت فروش جدید
                    </button>
                </div>
            </div>

            <div class="card mb-4" style="padding: 16px;">
                <div class="table-filters">
                    <select class="form-input" id="filterTxType" style="width: 200px;">
                        <option value="">همه تراکنش‌ها</option>
                        <option value="sale">فروش</option>
                        <option value="settlement">تسویه‌حساب</option>
                        <option value="debit_adjust">تعدیل (بدهکار کردن)</option>
                        <option value="credit_adjust">تعدیل (بستانکار کردن)</option>
                    </select>
                </div>
            </div>

            <div id="tableContainer"></div>
        `;

        this.table = new TableBuilder('tableContainer')
            .setColumns([
                { key: 'date', label: 'تاریخ', render: (val) => `<span class="ltr">${Utils.formatDate(val, true)}</span>` },
                { key: 'type', label: 'نوع', render: (val) => {
                    const map = {
                        'sale': '<span class="badge purple">فروش</span>',
                        'settlement': '<span class="badge success">تسویه حساب</span>',
                        'debit_adjust': '<span class="badge warning">تعدیل بدهی</span>',
                        'credit_adjust': '<span class="badge info">تعدیل بستانکاری</span>'
                    };
                    return map[val] || val;
                }},
                { key: 'description', label: 'شرح' },
                { key: 'amount', label: 'مبلغ (تومان)', render: (val, row) => {
                    const isCredit = row.type === 'settlement' || row.type === 'credit_adjust';
                    return `<span class="fw-bold ltr ${isCredit ? 'text-cyan' : 'text-red'}">${isCredit ? '-' : '+'}${Utils.formatMoney(val)}</span>`;
                }},
                { key: 'running_balance', label: 'مانده', render: (val) => {
                    if (val === 0) return '۰ (تسویه)';
                    if (val > 0) return `<span class="text-red ltr">${Utils.formatMoney(val)}</span> <span class="font-size-11">بد</span>`;
                    return `<span class="text-cyan ltr">${Utils.formatMoney(-val)}</span> <span class="font-size-11">بس</span>`;
                }}
            ]);

        document.getElementById('filterTxType').addEventListener('change', () => this.loadLedger());

        await this.loadData();
    },

    async loadData() {
        try {
            const data = await Utils.api(`/resellers/${this.resellerId}`);
            this.renderProfile(data);
            await this.loadLedger();
        } catch (err) {
            window.location.hash = '#resellers';
        }
    },

    async loadLedger() {
        try {
            const type = document.getElementById('filterTxType').value;
            let url = `/resellers/${this.resellerId}/ledger`;
            if (type) url += `?type=${type}`;

            const ledger = await Utils.api(url);
            this.table.setData(ledger).render();
        } catch(e) {}
    },

    renderProfile(data) {
        const r = data.reseller;
        
        let balanceBadge = '';
        if (data.balance === 0) balanceBadge = '<span class="badge info" style="font-size:14px">تسویه</span>';
        else if (data.balance > 0) balanceBadge = `<span class="badge danger" style="font-size:14px">بدهکار: <span class="ltr ml-1">${Utils.formatMoney(data.balance)}</span></span>`;
        else balanceBadge = `<span class="badge success" style="font-size:14px">بستانکار: <span class="ltr ml-1">${Utils.formatMoney(-data.balance)}</span></span>`;

        document.getElementById('profileHeader').innerHTML = `
            <div class="profile-header">
                <div class="profile-avatar">${Utils.getInitials(r.full_name)}</div>
                <div class="profile-info">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <div class="profile-name">${r.full_name} ${r.status === 'active' ? '<span class="badge success" style="font-size:10px;vertical-align:middle">فعال</span>' : ''}</div>
                            <div class="profile-meta">
                                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> ${r.mobile || '-'}</span>
                                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-18.6 7.227c-1.545.6-1.522 2.824.032 3.395l4.897 1.8 1.488 4.707c.214.674 1.139.774 1.503.161l2.846-4.782 5.093 3.766c1.171.866 2.862.138 3.018-1.31l2.45-23.01a2.242 2.242 0 0 0-2.705-2.168z"></path></svg> <span class="ltr">${r.telegram_id || '-'}</span></span>
                            </div>
                        </div>
                        <div style="text-align:left;">
                            <div class="text-muted font-size-12 mb-2">وضعیت فعلی حساب</div>
                            ${balanceBadge}
                        </div>
                    </div>
                    
                    <hr style="border:0; border-top:1px solid var(--border); margin:20px 0;">
                    
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:24px;">
                        <div>
                            <div class="text-muted font-size-11 fw-bold">کل فروش (درآمد)</div>
                            <div class="fw-bold font-size-16 ltr">${Utils.formatMoney(data.total_sales)}</div>
                        </div>
                        <div>
                            <div class="text-muted font-size-11 fw-bold">کل تسویه‌حساب‌ها</div>
                            <div class="fw-bold font-size-16 ltr text-cyan">${Utils.formatMoney(data.total_settlements)}</div>
                        </div>
                        <div>
                            <div class="text-muted font-size-11 fw-bold">آخرین تسویه</div>
                            <div class="fw-bold font-size-14 ltr">${data.last_settlement ? Utils.formatDate(data.last_settlement) : '-'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    showSaleModal() {
        Modal.open({
            title: 'ثبت فروش برای نماینده',
            body: `
                <form id="saleForm">
                    <div class="form-group">
                        <label class="form-label">مبلغ فروش (تومان)</label>
                        <input type="number" name="amount" class="form-input" required min="1000">
                        <div class="form-hint">این مبلغ به بدهی نماینده افزوده می‌شود.</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">بابت / توضیحات</label>
                        <input type="text" name="description" class="form-input" required placeholder="مثال: فروش ۱۰ اکانت یک‌ماهه">
                    </div>
                </form>
            `,
            footer: `
                <button type="button" class="btn btn-ghost" data-dismiss="modal">انصراف</button>
                <button type="button" class="btn btn-primary" onclick="window.ResellerDetailPage.submitAction('/sale', 'saleForm')">ثبت فروش</button>
            `
        });
    },

    showAdjustModal() {
        Modal.open({
            title: 'تعدیل حساب نماینده',
            body: `
                <form id="adjustForm">
                    <div class="form-group">
                        <label class="form-label">نوع تعدیل</label>
                        <select name="type" class="form-input" required>
                            <option value="debit_adjust">بدهکار کردن (افزایش بدهی)</option>
                            <option value="credit_adjust">بستانکار کردن (کاهش بدهی/تخفیف)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">مبلغ (تومان)</label>
                        <input type="number" name="amount" class="form-input" required min="1000">
                    </div>
                    <div class="form-group">
                        <label class="form-label">علت تعدیل</label>
                        <input type="text" name="description" class="form-input" required placeholder="مثال: اصلاح حساب، تخفیف، جبران خسارت">
                    </div>
                </form>
            `,
            footer: `
                <button type="button" class="btn btn-ghost" data-dismiss="modal">انصراف</button>
                <button type="button" class="btn btn-primary" onclick="window.ResellerDetailPage.submitAction('/adjust', 'adjustForm')">ثبت تعدیل</button>
            `
        });
    },

    async submitAction(endpointSuffix, formId) {
        const form = document.getElementById(formId);
        if (!form.reportValidity()) return;

        const data = Object.fromEntries(new FormData(form).entries());
        data.amount = parseInt(data.amount);

        try {
            await Utils.api(`/resellers/${this.resellerId}${endpointSuffix}`, { method: 'POST', body: data });
            Toast.success('عملیات با موفقیت ثبت شد');
            Modal.close();
            this.loadData();
        } catch(e) {}
    }
};
