// revenues.js

window.RevenuesPage = {
    container: null,
    table: null,
    banks: [],
    
    async render(container) {
        this.container = container;
        
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-wrap">
                    <h2>مدیریت درآمدها</h2>
                    <p>ثبت و پیگیری درآمدهای حاصل از فروش و خدمات</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-primary" id="btnNewRevenue">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        ثبت درآمد جدید
                    </button>
                </div>
            </div>

            <div class="card mb-4" style="padding: 16px;">
                <div class="table-filters" id="revenueFilters">
                    <select class="form-input" id="filterSource" style="width: 200px;">
                        <option value="">همه منابع</option>
                        <option value="zarinpal">زرین‌پال</option>
                        <option value="card_to_card">کارت به کارت</option>
                        <option value="manual">دستی</option>
                    </select>
                </div>
            </div>

            <div id="tableContainer"></div>
        `;

        this.table = new TableBuilder('tableContainer')
            .setColumns([
                { key: 'source', label: 'منبع', render: (val) => {
                    const map = {
                        'zarinpal': '<span class="badge success">زرین‌پال</span>',
                        'card_to_card': '<span class="badge info">کارت به کارت</span>',
                        'manual': '<span class="badge warning">دستی</span>'
                    };
                    return map[val] || val;
                }},
                { key: 'amount', label: 'مبلغ (تومان)', render: (val) => `<span class="fw-bold ltr text-cyan">${Utils.formatMoney(val)}</span>` },
                { key: 'BankAccount.title', label: 'حساب مقصد' },
                { key: 'date', label: 'تاریخ', render: (val) => `<span class="ltr">${Utils.formatDate(val, true)}</span>` },
                { key: 'notes', label: 'توضیحات' }
            ])
            .setActions((row) => `
                <button class="btn-icon text-red" title="حذف" onclick="window.RevenuesPage.delete(${row.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            `);

        document.getElementById('btnNewRevenue').addEventListener('click', () => this.showModal());
        document.getElementById('filterSource').addEventListener('change', () => this.loadData());

        this.table.renderSkeleton();
        
        // Load dependencies
        try {
            this.banks = await Utils.api('/banks');
        } catch(e) {}

        await this.loadData();
    },

    async loadData() {
        try {
            const source = document.getElementById('filterSource').value;
            let url = '/revenues?limit=100';
            if (source) url += `&source=${source}`;

            const res = await Utils.api(url);
            this.table.setData(res.data).render();
        } catch (err) {
            console.error(err);
        }
    },

    showModal() {
        const banksOptions = this.banks.filter(b => b.status === 'active').map(b => `<option value="${b.id}">${b.title} (${Utils.formatMoney(b.balance)})</option>`).join('');

        Modal.open({
            title: 'ثبت درآمد جدید',
            body: `
                <form id="revenueForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">منبع درآمد</label>
                            <select name="source" id="sourceSelect" class="form-input" required>
                                <option value="zarinpal">درگاه زرین‌پال</option>
                                <option value="card_to_card">کارت به کارت</option>
                                <option value="manual">ثبت دستی</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">مبلغ (تومان)</label>
                            <input type="number" name="amount" class="form-input" required min="1000">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">حساب مقصد (واریز به)</label>
                            <select name="bank_account_id" class="form-input" required>
                                <option value="">انتخاب حساب...</option>
                                ${banksOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">تاریخ و زمان (اختیاری)</label>
                            <input type="datetime-local" name="date" class="form-input">
                            <div class="form-hint">در صورت خالی بودن، زمان فعلی ثبت می‌شود.</div>
                        </div>
                    </div>

                    <div id="dynamicFields">
                        <div class="form-group">
                            <label class="form-label">شماره تراکنش / Ref ID</label>
                            <input type="text" name="transaction_ref" class="form-input ltr text-right">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">توضیحات تکمیلی</label>
                        <input type="text" name="notes" class="form-input">
                    </div>
                </form>
            `,
            footer: `
                <button type="button" class="btn btn-ghost" data-dismiss="modal">انصراف</button>
                <button type="button" class="btn btn-primary" onclick="window.RevenuesPage.save()">ثبت و ذخیره</button>
            `
        });

        // Dynamic fields based on source
        const sourceSelect = document.getElementById('sourceSelect');
        const dynamicFields = document.getElementById('dynamicFields');
        
        sourceSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'zarinpal') {
                dynamicFields.innerHTML = `
                    <div class="form-group">
                        <label class="form-label">شماره تراکنش / Ref ID</label>
                        <input type="text" name="transaction_ref" class="form-input ltr text-right">
                    </div>
                `;
            } else if (val === 'card_to_card') {
                dynamicFields.innerHTML = `
                    <div class="form-group">
                        <label class="form-label">شماره کارت مبدا (اختیاری)</label>
                        <input type="text" name="source_card" class="form-input ltr text-right" placeholder="1234-5678-9012-3456">
                    </div>
                `;
            } else {
                dynamicFields.innerHTML = `
                    <div class="form-group">
                        <label class="form-label">دسته بندی</label>
                        <input type="text" name="category_name" class="form-input">
                    </div>
                `;
            }
        });
    },

    async save() {
        const form = document.getElementById('revenueForm');
        if (!form.reportValidity()) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        data.amount = parseInt(data.amount);
        data.bank_account_id = parseInt(data.bank_account_id);
        
        if (!data.date) delete data.date;
        else data.date = new Date(data.date).toISOString();

        try {
            await Utils.api('/revenues', {
                method: 'POST',
                body: data
            });
            Toast.success('درآمد با موفقیت ثبت شد');
            Modal.close();
            this.loadData();
        } catch (err) {}
    },

    delete(id) {
        Modal.confirmDelete({
            message: 'آیا از حذف این رکورد درآمد اطمینان دارید؟ با این کار موجودی حساب بانکی مرتبط نیز کاهش می‌یابد و ثبت‌های حسابداری مرتبط حذف می‌شوند.',
            onConfirm: async () => {
                await Utils.api(`/revenues/${id}`, { method: 'DELETE' });
                Toast.success('حذف شد');
                this.loadData();
            }
        });
    }
};
