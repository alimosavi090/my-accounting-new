// expenses.js

window.ExpensesPage = {
    container: null,
    table: null,
    categories: [],
    banks: [],
    
    async render(container) {
        this.container = container;
        
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-wrap">
                    <h2>مدیریت هزینه‌ها</h2>
                    <p>ثبت هزینه‌های زیرساخت (سرور، پهنای باند) و هزینه‌های جاری</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-ghost" id="btnManageCat">مدیریت دسته‌بندی‌ها</button>
                    <button class="btn btn-primary" id="btnNewExpense">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        ثبت هزینه جدید
                    </button>
                </div>
            </div>

            <div class="tabs" id="expenseTabs">
                <button class="tab active" data-cat="">همه هزینه‌ها</button>
                <!-- Tabs will be injected here -->
            </div>

            <div id="tableContainer"></div>
        `;

        this.table = new TableBuilder('tableContainer')
            .setColumns([
                { key: 'title', label: 'عنوان هزینه', render: (val, row) => `
                    <div>
                        <div class="fw-bold">${val}</div>
                        <div class="font-size-11 text-muted mt-1">${row.provider || ''}</div>
                    </div>
                `},
                { key: 'Category.name', label: 'دسته‌بندی', render: (val, row) => `
                    <span class="badge" style="background: ${row.Category?.color}22; color: ${row.Category?.color}">${row.Category?.icon || ''} ${val || '-'}</span>
                `},
                { key: 'amount', label: 'مبلغ (تومان)', render: (val) => `<span class="fw-bold ltr text-red">${Utils.formatMoney(val)}</span>` },
                { key: 'is_paid', label: 'وضعیت', render: (val) => val ? '<span class="badge success">پرداخت شده</span>' : '<span class="badge warning">پرداخت نشده</span>' },
                { key: 'BankAccount.title', label: 'پرداخت از' },
                { key: 'renewal_date', label: 'تاریخ تمدید', render: (val) => {
                    if (!val) return '-';
                    const d = new Date(val);
                    const now = new Date();
                    const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
                    
                    let color = 'text-muted';
                    let text = Utils.formatDate(val);
                    
                    if (diffDays <= 0) { color = 'text-red fw-bold'; text += ' (منقضی شده)'; }
                    else if (diffDays <= 7) { color = 'text-orange fw-bold'; text += ` (${diffDays} روز دیگر)`; }
                    
                    return `<span class="ltr ${color}">${text}</span>`;
                }},
                { key: 'date', label: 'تاریخ ثبت', render: (val) => `<span class="ltr">${Utils.formatDate(val)}</span>` }
            ])
            .setActions((row) => `
                <button class="btn-icon text-red" title="حذف" onclick="window.ExpensesPage.delete(${row.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            `);

        document.getElementById('btnNewExpense').addEventListener('click', () => this.showModal());
        document.getElementById('btnManageCat').addEventListener('click', () => this.showCategoryModal());

        this.table.renderSkeleton();
        
        try {
            const [cats, banks] = await Promise.all([
                Utils.api('/expense-categories'),
                Utils.api('/banks')
            ]);
            this.categories = cats;
            this.banks = banks;
            
            this.renderTabs();
        } catch(e) {}

        await this.loadData();
    },

    renderTabs() {
        const tabsContainer = document.getElementById('expenseTabs');
        let html = '<button class="tab active" data-cat="">همه هزینه‌ها</button>';
        
        // Only show system categories as tabs
        this.categories.filter(c => c.is_system).forEach(cat => {
            html += `<button class="tab" data-cat="${cat.id}">${cat.icon} ${cat.name}</button>`;
        });
        
        tabsContainer.innerHTML = html;

        tabsContainer.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.loadData(e.target.dataset.cat);
            });
        });
    },

    async loadData(categoryId = '') {
        try {
            let url = '/expenses?limit=100';
            if (categoryId) url += `&category_id=${categoryId}`;

            const res = await Utils.api(url);
            this.table.setData(res.data).render();
        } catch (err) {}
    },

    showModal() {
        const banksOptions = this.banks.filter(b => b.status === 'active').map(b => `<option value="${b.id}">${b.title}</option>`).join('');
        const catsOptions = this.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        Modal.open({
            title: 'ثبت هزینه جدید',
            body: `
                <form id="expenseForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">عنوان هزینه</label>
                            <input type="text" name="title" class="form-input" required placeholder="مثال: سرور آلمان هتزنر">
                        </div>
                        <div class="form-group">
                            <label class="form-label">دسته‌بندی</label>
                            <select name="category_id" class="form-input" required>
                                <option value="">انتخاب کنید...</option>
                                ${catsOptions}
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">مبلغ (تومان)</label>
                            <input type="number" name="amount" class="form-input" required min="1000">
                        </div>
                        <div class="form-group">
                            <label class="form-label">پرداخت از حساب (اختیاری)</label>
                            <select name="bank_account_id" class="form-input">
                                <option value="">بدون پرداخت / نسیه</option>
                                ${banksOptions}
                            </select>
                            <div class="form-hint">در صورت انتخاب، از موجودی حساب کسر می‌شود.</div>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">تاریخ پرداخت / ثبت</label>
                            <input type="date" name="date" class="form-input" required value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">تاریخ سررسید/تمدید بعدی (اختیاری)</label>
                            <input type="date" name="renewal_date" class="form-input">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">نام سرویس‌دهنده / پروایدر (اختیاری)</label>
                            <input type="text" name="provider" class="form-input" placeholder="مثال: پارس آنلاین، OVH">
                        </div>
                        <div class="form-group">
                            <label class="form-label">وضعیت پرداخت</label>
                            <select name="is_paid" class="form-input">
                                <option value="true">پرداخت شده</option>
                                <option value="false">پرداخت نشده (بدهی)</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">توضیحات</label>
                        <input type="text" name="notes" class="form-input">
                    </div>
                </form>
            `,
            footer: `
                <button type="button" class="btn btn-ghost" data-dismiss="modal">انصراف</button>
                <button type="button" class="btn btn-primary" onclick="window.ExpensesPage.save()">ثبت هزینه</button>
            `
        });
    },

    async save() {
        const form = document.getElementById('expenseForm');
        if (!form.reportValidity()) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        data.amount = parseInt(data.amount);
        data.category_id = parseInt(data.category_id);
        
        if (data.bank_account_id) data.bank_account_id = parseInt(data.bank_account_id);
        else delete data.bank_account_id;

        if (data.date) data.date = new Date(data.date).toISOString();
        if (data.renewal_date) data.renewal_date = new Date(data.renewal_date).toISOString();
        else delete data.renewal_date;

        data.is_paid = data.is_paid === 'true';

        try {
            await Utils.api('/expenses', {
                method: 'POST',
                body: data
            });
            Toast.success('هزینه با موفقیت ثبت شد');
            Modal.close();
            const activeTab = document.querySelector('#expenseTabs .active');
            this.loadData(activeTab ? activeTab.dataset.cat : '');
        } catch (err) {}
    },

    delete(id) {
        Modal.confirmDelete({
            message: 'آیا از حذف این هزینه اطمینان دارید؟ در صورت پرداخت شدن از حساب، مبلغ به حساب بازگردانده می‌شود.',
            onConfirm: async () => {
                await Utils.api(`/expenses/${id}`, { method: 'DELETE' });
                Toast.success('حذف شد');
                const activeTab = document.querySelector('#expenseTabs .active');
                this.loadData(activeTab ? activeTab.dataset.cat : '');
            }
        });
    },

    showCategoryModal() {
        let html = `
            <div class="mb-4">
                <form id="catForm" style="display: flex; gap: 8px;">
                    <input type="text" name="name" class="form-input" placeholder="نام دسته‌بندی جدید" required>
                    <input type="text" name="icon" class="form-input" placeholder="آیکون (ایموجی)" style="width: 80px;">
                    <button type="button" class="btn btn-primary" onclick="window.ExpensesPage.saveCategory()">افزودن</button>
                </form>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead><tr><th>آیکون</th><th>نام</th><th>نوع</th></tr></thead>
                    <tbody>
        `;

        this.categories.forEach(c => {
            html += `
                <tr>
                    <td>${c.icon || ''}</td>
                    <td>${c.name}</td>
                    <td>${c.is_system ? '<span class="badge info">سیستمی</span>' : '<span class="badge warning">سفارشی</span>'}</td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;

        Modal.open({
            title: 'مدیریت دسته‌بندی‌های هزینه',
            body: html,
            footer: `<button type="button" class="btn btn-ghost" data-dismiss="modal">بستن</button>`
        });
    },

    async saveCategory() {
        const form = document.getElementById('catForm');
        if (!form.reportValidity()) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.color = '#8b8fa3'; // Default color

        try {
            await Utils.api('/expense-categories', {
                method: 'POST',
                body: data
            });
            Toast.success('دسته‌بندی افزوده شد');
            Modal.close();
            // Reload page to get new categories
            this.render(this.container);
        } catch (err) {}
    }
};
