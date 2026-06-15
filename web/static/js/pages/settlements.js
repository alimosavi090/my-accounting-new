// settlements.js

window.SettlementsPage = {
    container: null,
    table: null,
    resellers: [],
    banks: [],
    
    async render(container) {
        this.container = container;
        
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-wrap">
                    <h2>تسویه‌حساب نمایندگان</h2>
                    <p>ثبت دریافتی‌ها و تسویه‌حساب با نمایندگان فروش</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-primary" id="btnNewSettlement">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                        ثبت تسویه جدید
                    </button>
                </div>
            </div>

            <div class="card mb-4" style="padding: 16px;">
                <div class="table-filters" id="settlementFilters">
                    <select class="form-input" id="filterReseller" style="width: 250px;">
                        <option value="">همه نمایندگان</option>
                    </select>
                </div>
            </div>

            <div id="tableContainer"></div>
        `;

        this.table = new TableBuilder('tableContainer')
            .setColumns([
                { key: 'Reseller.full_name', label: 'نماینده', render: (val, row) => `<span class="fw-bold text-cyan" style="cursor:pointer" onclick="window.location.hash='#reseller-detail'; setTimeout(()=>window.ResellerDetailPage.render(document.getElementById('mainContent'), {id:${row.reseller_id}}), 50)">${val}</span>` },
                { key: 'amount', label: 'مبلغ تسویه (تومان)', render: (val) => `<span class="fw-bold ltr text-cyan">${Utils.formatMoney(val)}</span>` },
                { key: 'BankAccount.title', label: 'واریز به حساب' },
                { key: 'date', label: 'تاریخ', render: (val) => `<span class="ltr">${Utils.formatDate(val, true)}</span>` },
                { key: 'notes', label: 'توضیحات' }
            ]);

        document.getElementById('btnNewSettlement').addEventListener('click', () => this.showModal());
        document.getElementById('filterReseller').addEventListener('change', () => this.loadData());

        this.table.renderSkeleton();
        
        try {
            const [resellers, banks] = await Promise.all([
                Utils.api('/resellers'),
                Utils.api('/banks')
            ]);
            this.resellers = resellers;
            this.banks = banks;
            
            const filterSelect = document.getElementById('filterReseller');
            resellers.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = r.full_name;
                filterSelect.appendChild(opt);
            });
            
        } catch(e) {}

        await this.loadData();
    },

    async loadData() {
        try {
            const rId = document.getElementById('filterReseller').value;
            let url = '/settlements?limit=100';
            if (rId) url += `&reseller_id=${rId}`;

            const res = await Utils.api(url);
            this.table.setData(res.data).render();
        } catch (err) {}
    },

    showModal() {
        // فیلتر کردن نمایندگانی که بدهکار هستند
        const debtorResellers = this.resellers.filter(r => r.balance > 0);
        
        let resellersOptions = '<option value="">ابتدا یک نماینده انتخاب کنید...</option>';
        debtorResellers.forEach(r => {
            resellersOptions += `<option value="${r.id}" data-debt="${r.balance}">${r.full_name} (بدهی: ${Utils.formatMoney(r.balance)})</option>`;
        });

        if (debtorResellers.length === 0) {
            // اگر کسی بدهکار نیست همه را نشان بده
            resellersOptions = '<option value="">همه نمایندگان تسویه هستند...</option>';
            this.resellers.forEach(r => {
                resellersOptions += `<option value="${r.id}" data-debt="${r.balance}">${r.full_name}</option>`;
            });
        }

        const banksOptions = this.banks.filter(b => b.status === 'active').map(b => `<option value="${b.id}">${b.title}</option>`).join('');

        Modal.open({
            title: 'ثبت تسویه‌حساب نماینده',
            body: `
                <form id="settlementForm">
                    <div class="form-group">
                        <label class="form-label">نماینده</label>
                        <select name="reseller_id" id="stReseller" class="form-input" required>
                            ${resellersOptions}
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">مبلغ پرداختی نماینده (تومان)</label>
                            <input type="number" name="amount" id="stAmount" class="form-input" required min="1000">
                            <div class="form-hint">
                                <a href="#" id="stFillDebt" style="color:var(--cyan); text-decoration:underline;">جایگذاری کل بدهی</a>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">واریز به حساب</label>
                            <select name="bank_account_id" class="form-input" required>
                                <option value="">انتخاب حساب بانکی...</option>
                                ${banksOptions}
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">تاریخ تسویه (اختیاری)</label>
                            <input type="datetime-local" name="date" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">توضیحات</label>
                            <input type="text" name="notes" class="form-input" placeholder="بابت تسویه دوره‌ای...">
                        </div>
                    </div>
                </form>
            `,
            footer: `
                <button type="button" class="btn btn-ghost" data-dismiss="modal">انصراف</button>
                <button type="button" class="btn btn-primary" onclick="window.SettlementsPage.save()">ثبت و تایید</button>
            `
        });

        // Event for filling full debt
        document.getElementById('stFillDebt').addEventListener('click', (e) => {
            e.preventDefault();
            const select = document.getElementById('stReseller');
            const selected = select.options[select.selectedIndex];
            if (selected && selected.dataset.debt && parseInt(selected.dataset.debt) > 0) {
                document.getElementById('stAmount').value = selected.dataset.debt;
            }
        });
    },

    async save() {
        const form = document.getElementById('settlementForm');
        if (!form.reportValidity()) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        data.amount = parseInt(data.amount);
        data.reseller_id = parseInt(data.reseller_id);
        data.bank_account_id = parseInt(data.bank_account_id);
        
        if (!data.date) delete data.date;
        else data.date = new Date(data.date).toISOString();

        try {
            await Utils.api('/settlements', {
                method: 'POST',
                body: data
            });
            Toast.success('تسویه‌حساب با موفقیت ثبت شد');
            Modal.close();
            
            // Reload resellers in background to update debts
            Utils.api('/resellers').then(res => this.resellers = res);
            
            this.loadData();
        } catch (err) {}
    }
};
