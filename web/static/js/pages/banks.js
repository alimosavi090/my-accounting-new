// banks.js

window.BanksPage = {
    container: null,
    
    async render(container) {
        this.container = container;
        
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-wrap">
                    <h2>حساب‌های بانکی</h2>
                    <p>مدیریت موجودی، واریز، برداشت و انتقال وجه</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-ghost" id="btnTransfer">انتقال بین حسابی</button>
                    <button class="btn btn-primary" id="btnNewBank">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        افزودن حساب
                    </button>
                </div>
            </div>

            <div class="banks-grid" id="banksGrid">
                <!-- Skeletons -->
                <div class="bank-card"><div class="skeleton" style="height: 120px;"></div></div>
                <div class="bank-card"><div class="skeleton" style="height: 120px;"></div></div>
                <div class="bank-card"><div class="skeleton" style="height: 120px;"></div></div>
            </div>
        `;

        document.getElementById('btnNewBank').addEventListener('click', () => this.showModal());
        document.getElementById('btnTransfer').addEventListener('click', () => this.showTransferModal());

        await this.loadData();
    },

    async loadData() {
        try {
            const banks = await Utils.api('/banks');
            this.renderBanks(banks);
        } catch (err) {}
    },

    renderBanks(banks) {
        const grid = document.getElementById('banksGrid');
        
        if (banks.length === 0) {
            grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">حسابی ثبت نشده است</div>';
            return;
        }

        let html = '';
        banks.forEach(bank => {
            const color = bank.color || '#4361ee';
            html += `
                <div class="bank-card" style="border-top: 4px solid ${color}">
                    <div class="bank-name">
                        <span>${bank.title} <span class="badge ${bank.status === 'active' ? 'success' : 'warning'}" style="font-size: 10px; margin-right: 8px;">${bank.status === 'active' ? 'فعال' : 'غیرفعال'}</span></span>
                        <button class="btn-icon" onclick="window.BanksPage.showActions(${bank.id}, '${bank.title}', ${bank.balance})">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                        </button>
                    </div>
                    <div class="text-muted font-size-12 mb-2">${bank.bank_name || 'بانک نامشخص'}</div>
                    <div class="bank-balance ltr text-cyan">${Utils.formatMoney(bank.balance)}</div>
                    <div class="text-muted font-size-11 ltr mt-1">تومان</div>
                    <div class="bank-card-number mt-4">${bank.card_number || 'شماره کارت ثبت نشده'}</div>
                    
                    <div style="display: flex; gap: 8px; margin-top: 20px;">
                        <button class="btn btn-ghost" style="flex:1; padding: 6px; font-size: 12px;" onclick="window.BanksPage.showDeposit(${bank.id}, '${bank.title}')">واریز</button>
                        <button class="btn btn-ghost" style="flex:1; padding: 6px; font-size: 12px;" onclick="window.BanksPage.showWithdraw(${bank.id}, '${bank.title}')">برداشت</button>
                    </div>
                </div>
            `;
        });
        
        grid.innerHTML = html;
    },

    showActions(id, title, balance) {
        Modal.open({
            title: `مدیریت حساب: ${title}`,
            body: `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <button class="btn btn-ghost" style="justify-content:flex-start" onclick="window.location.hash='#reports'; setTimeout(()=>window.ReportsPage.loadBankReport(${id}), 100); Modal.close();">مشاهده گزارش حساب و تاریخچه</button>
                    <button class="btn btn-ghost" style="justify-content:flex-start" onclick="window.BanksPage.edit(${id});">ویرایش مشخصات</button>
                    <hr style="border:0; border-top:1px solid var(--border); margin:4px 0">
                    <button class="btn btn-danger" style="justify-content:flex-start" onclick="window.BanksPage.delete(${id})">حذف حساب</button>
                </div>
            `,
            footer: `<button type="button" class="btn btn-ghost" data-dismiss="modal">بستن</button>`
        });
    },

    showModal(bank = null) {
        Modal.open({
            title: bank ? 'ویرایش حساب' : 'افزودن حساب جدید',
            body: `
                <form id="bankForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">عنوان حساب (در سیستم)</label>
                            <input type="text" name="title" class="form-input" required placeholder="مثال: حساب اصلی، حساب فروش..." value="${bank?.title || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">نام بانک</label>
                            <input type="text" name="bank_name" class="form-input" placeholder="مثال: ملت، ملی، سامان" value="${bank?.bank_name || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">شماره کارت</label>
                            <input type="text" name="card_number" class="form-input ltr text-right" placeholder="1234-5678-9012-3456" value="${bank?.card_number || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">شماره حساب / شبا</label>
                            <input type="text" name="account_number" class="form-input ltr text-right" value="${bank?.account_number || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">رنگ نشانگر</label>
                            <input type="color" name="color" class="form-input" style="height: 44px; padding: 4px;" value="${bank?.color || '#4361ee'}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">وضعیت</label>
                            <select name="status" class="form-input">
                                <option value="active" ${bank?.status === 'active' ? 'selected' : ''}>فعال</option>
                                <option value="inactive" ${bank?.status === 'inactive' ? 'selected' : ''}>غیرفعال</option>
                            </select>
                        </div>
                    </div>
                </form>
            `,
            footer: `
                <button type="button" class="btn btn-ghost" data-dismiss="modal">انصراف</button>
                <button type="button" class="btn btn-primary" onclick="window.BanksPage.save(${bank ? bank.id : 'null'})">ذخیره</button>
            `
        });
    },

    async edit(id) {
        try {
            const bank = await Utils.api(`/banks/${id}`);
            this.showModal(bank);
        } catch(e) {}
    },

    async save(id) {
        const form = document.getElementById('bankForm');
        if (!form.reportValidity()) return;

        const data = Object.fromEntries(new FormData(form).entries());

        try {
            if (id) {
                await Utils.api(`/banks/${id}`, { method: 'PUT', body: data });
                Toast.success('بروزرسانی شد');
            } else {
                await Utils.api('/banks', { method: 'POST', body: data });
                Toast.success('حساب افزوده شد');
            }
            Modal.close();
            this.loadData();
        } catch(e) {}
    },

    delete(id) {
        Modal.confirmDelete({
            message: 'آیا از حذف این حساب بانکی اطمینان دارید؟',
            onConfirm: async () => {
                await Utils.api(`/banks/${id}`, { method: 'DELETE' });
                Toast.success('حذف شد');
                this.loadData();
            }
        });
    },

    // Transaction Functions
    showDeposit(id, title) {
        Modal.open({
            title: `واریز به ${title}`,
            body: `
                <form id="depositForm">
                    <input type="hidden" name="bank_account_id" value="${id}">
                    <div class="form-group">
                        <label class="form-label">مبلغ (تومان)</label>
                        <input type="number" name="amount" class="form-input" required min="1000">
                    </div>
                    <div class="form-group">
                        <label class="form-label">بابت / توضیحات</label>
                        <input type="text" name="notes" class="form-input" required placeholder="مثال: واریز شخصی">
                    </div>
                </form>
            `,
            footer: `<button type="button" class="btn btn-ghost" data-dismiss="modal">انصراف</button>
                     <button type="button" class="btn btn-primary" onclick="window.BanksPage.submitTransaction('/banks/deposit', 'depositForm')">ثبت واریز</button>`
        });
    },

    showWithdraw(id, title) {
        Modal.open({
            title: `برداشت از ${title}`,
            body: `
                <form id="withdrawForm">
                    <input type="hidden" name="bank_account_id" value="${id}">
                    <div class="form-group">
                        <label class="form-label">مبلغ (تومان)</label>
                        <input type="number" name="amount" class="form-input" required min="1000">
                    </div>
                    <div class="form-group">
                        <label class="form-label">بابت / توضیحات</label>
                        <input type="text" name="notes" class="form-input" required placeholder="مثال: برداشت شخصی">
                    </div>
                </form>
            `,
            footer: `<button type="button" class="btn btn-ghost" data-dismiss="modal">انصراف</button>
                     <button type="button" class="btn btn-danger" onclick="window.BanksPage.submitTransaction('/banks/withdraw', 'withdrawForm')">ثبت برداشت</button>`
        });
    },

    async showTransferModal() {
        try {
            const banks = await Utils.api('/banks');
            const activeBanks = banks.filter(b => b.status === 'active');
            
            if (activeBanks.length < 2) {
                Toast.error('برای انتقال حداقل به ۲ حساب فعال نیاز است');
                return;
            }

            const options = activeBanks.map(b => `<option value="${b.id}">${b.title} (موجودی: ${Utils.formatMoney(b.balance)})</option>`).join('');

            Modal.open({
                title: 'انتقال بین حسابی',
                body: `
                    <form id="transferForm">
                        <div class="form-group">
                            <label class="form-label">از حساب (مبدا)</label>
                            <select name="source_id" id="transferSrc" class="form-input" required>
                                <option value="">انتخاب مبدا...</option>
                                ${options}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">به حساب (مقصد)</label>
                            <select name="dest_id" id="transferDst" class="form-input" required>
                                <option value="">انتخاب مقصد...</option>
                                ${options}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">مبلغ (تومان)</label>
                            <input type="number" name="amount" class="form-input" required min="1000">
                        </div>
                        <div class="form-group">
                            <label class="form-label">توضیحات (اختیاری)</label>
                            <input type="text" name="notes" class="form-input">
                        </div>
                    </form>
                `,
                footer: `<button type="button" class="btn btn-ghost" data-dismiss="modal">انصراف</button>
                         <button type="button" class="btn btn-primary" onclick="window.BanksPage.submitTransaction('/banks/transfer', 'transferForm')">ثبت انتقال</button>`
            });

            // Prevent selecting same source and dest
            const src = document.getElementById('transferSrc');
            const dst = document.getElementById('transferDst');
            src.addEventListener('change', () => {
                Array.from(dst.options).forEach(opt => opt.disabled = opt.value === src.value);
            });

        } catch(e) {}
    },

    async submitTransaction(endpoint, formId) {
        const form = document.getElementById(formId);
        if (!form.reportValidity()) return;

        const data = Object.fromEntries(new FormData(form).entries());
        
        // Convert numbers
        if (data.amount) data.amount = parseInt(data.amount);
        if (data.bank_account_id) data.bank_account_id = parseInt(data.bank_account_id);
        if (data.source_id) data.source_id = parseInt(data.source_id);
        if (data.dest_id) data.dest_id = parseInt(data.dest_id);

        try {
            await Utils.api(endpoint, { method: 'POST', body: data });
            Toast.success('عملیات با موفقیت انجام شد');
            Modal.close();
            this.loadData();
        } catch(e) {}
    }
};
