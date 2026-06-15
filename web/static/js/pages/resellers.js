// resellers.js

window.ResellersPage = {
    container: null,
    table: null,
    
    async render(container) {
        this.container = container;
        
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-wrap">
                    <h2>لیست نمایندگان</h2>
                    <p>مدیریت نمایندگان فروش، میزان بدهی و بستانکاری</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-primary" id="btnNewReseller">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
                        افزودن نماینده
                    </button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr);" id="resellerSummary">
                <div class="skeleton" style="height: 100px;"></div>
                <div class="skeleton" style="height: 100px;"></div>
                <div class="skeleton" style="height: 100px;"></div>
                <div class="skeleton" style="height: 100px;"></div>
            </div>

            <div id="tableContainer"></div>
        `;

        this.table = new TableBuilder('tableContainer')
            .setColumns([
                { key: 'full_name', label: 'نام نماینده', render: (val, row) => `
                    <div style="display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="window.location.hash='#reseller-detail'; setTimeout(()=>window.ResellerDetailPage.render(document.getElementById('mainContent'), {id:${row.id}}), 50)">
                        <div style="width:36px; height:36px; border-radius:50%; background:var(--bg-input); display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--text-2)">
                            ${Utils.getInitials(val)}
                        </div>
                        <div>
                            <div class="fw-bold text-cyan" style="transition: color 0.2s;">${val}</div>
                            <div class="text-muted font-size-11">${row.telegram_id || '-'}</div>
                        </div>
                    </div>
                `},
                { key: 'mobile', label: 'موبایل', render: (val) => `<span class="ltr">${val || '-'}</span>` },
                { key: 'total_sales', label: 'کل فروش', render: (val) => `<span class="ltr">${Utils.formatMoney(val)}</span>` },
                { key: 'balance', label: 'وضعیت (بدهی/طلب)', render: (val) => {
                    if (val === 0) return '<span class="badge info">تسویه</span>';
                    if (val > 0) return `<span class="badge danger">بدهکار: <span class="ltr ml-1">${Utils.formatMoney(val)}</span></span>`;
                    return `<span class="badge success">بستانکار: <span class="ltr ml-1">${Utils.formatMoney(-val)}</span></span>`;
                }},
                { key: 'status', label: 'وضعیت', render: (val) => val === 'active' ? '<span class="badge success">فعال</span>' : '<span class="badge warning">غیرفعال</span>' }
            ])
            .setActions((row) => `
                <button class="btn-icon text-cyan" title="مشاهده پرونده" onclick="window.location.hash='#reseller-detail'; setTimeout(()=>window.ResellerDetailPage.render(document.getElementById('mainContent'), {id:${row.id}}), 50)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
                <button class="btn-icon text-blue" title="ویرایش" onclick="window.ResellersPage.edit(${row.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
            `);

        document.getElementById('btnNewReseller').addEventListener('click', () => this.showModal());

        this.table.renderSkeleton();
        await this.loadData();
    },

    async loadData() {
        try {
            const data = await Utils.api('/resellers');
            this.table.setData(data).render();
            this.renderSummary(data);
        } catch (err) {}
    },

    renderSummary(data) {
        const total = data.length;
        const active = data.filter(r => r.status === 'active').length;
        
        let totalDebt = 0;
        let totalCredit = 0;
        
        data.forEach(r => {
            if (r.balance > 0) totalDebt += r.balance;
            if (r.balance < 0) totalCredit += Math.abs(r.balance);
        });

        document.getElementById('resellerSummary').innerHTML = `
            <div class="kpi-card">
                <div class="text-muted font-size-12 fw-bold mb-1">تعداد کل نمایندگان</div>
                <div class="font-size-24 fw-bold">${Utils.toPersianNum(total)}</div>
                <div class="text-success font-size-11 mt-1">${Utils.toPersianNum(active)} نماینده فعال</div>
            </div>
            <div class="kpi-card" style="border-bottom: 3px solid var(--red)">
                <div class="text-muted font-size-12 fw-bold mb-1">مجموع بدهی نمایندگان</div>
                <div class="font-size-20 fw-bold ltr text-red">${Utils.formatMoney(totalDebt)}</div>
            </div>
            <div class="kpi-card" style="border-bottom: 3px solid var(--cyan)">
                <div class="text-muted font-size-12 fw-bold mb-1">مجموع بستانکاری</div>
                <div class="font-size-20 fw-bold ltr text-cyan">${Utils.formatMoney(totalCredit)}</div>
            </div>
            <div class="kpi-card" style="border-bottom: 3px solid var(--purple)">
                <div class="text-muted font-size-12 fw-bold mb-1">خالص (طلب - بدهی)</div>
                <div class="font-size-20 fw-bold ltr">${Utils.formatMoney(totalDebt - totalCredit)}</div>
            </div>
        `;
    },

    showModal(reseller = null) {
        Modal.open({
            title: reseller ? 'ویرایش نماینده' : 'ثبت نماینده جدید',
            body: `
                <form id="resellerForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">نام و نام خانوادگی</label>
                            <input type="text" name="full_name" class="form-input" required value="${reseller?.full_name || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">شماره موبایل</label>
                            <input type="text" name="mobile" class="form-input ltr text-right" placeholder="09123456789" value="${reseller?.mobile || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">آیدی تلگرام</label>
                            <input type="text" name="telegram_id" class="form-input ltr text-right" placeholder="@username" value="${reseller?.telegram_id || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">وضعیت</label>
                            <select name="status" class="form-input">
                                <option value="active" ${reseller?.status === 'active' ? 'selected' : ''}>فعال</option>
                                <option value="inactive" ${reseller?.status === 'inactive' ? 'selected' : ''}>غیرفعال</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">یادداشت</label>
                        <input type="text" name="notes" class="form-input" value="${reseller?.notes || ''}">
                    </div>
                </form>
            `,
            footer: `
                <button type="button" class="btn btn-ghost" data-dismiss="modal">انصراف</button>
                <button type="button" class="btn btn-primary" onclick="window.ResellersPage.save(${reseller ? reseller.id : 'null'})">ذخیره</button>
            `
        });
    },

    async edit(id) {
        try {
            const data = await Utils.api(`/resellers/${id}`);
            this.showModal(data.reseller);
        } catch(e) {}
    },

    async save(id) {
        const form = document.getElementById('resellerForm');
        if (!form.reportValidity()) return;

        const data = Object.fromEntries(new FormData(form).entries());

        try {
            if (id) {
                await Utils.api(`/resellers/${id}`, { method: 'PUT', body: data });
                Toast.success('بروزرسانی شد');
            } else {
                await Utils.api('/resellers', { method: 'POST', body: data });
                Toast.success('نماینده افزوده شد');
            }
            Modal.close();
            this.loadData();
        } catch(e) {}
    }
};
