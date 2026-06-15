// components/modal.js

const Modal = {
    overlay: null,
    titleEl: null,
    bodyEl: null,
    footerEl: null,

    init() {
        this.overlay = document.getElementById('modalOverlay');
        this.titleEl = document.getElementById('modalTitle');
        this.bodyEl = document.getElementById('modalBody');
        this.footerEl = document.getElementById('modalFooter');
        
        document.getElementById('modalClose').addEventListener('click', () => this.close());
        
        // بستن با کلیک خارج از مدال
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // بستن با دکمه Esc
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('open')) {
                this.close();
            }
        });
    },

    open(options) {
        if (!this.overlay) this.init();

        this.titleEl.textContent = options.title || 'تنظیمات';
        this.bodyEl.innerHTML = options.body || '';
        this.footerEl.innerHTML = options.footer || '';

        // Attach event listeners to buttons
        if (options.onConfirm) {
            const confirmBtn = this.footerEl.querySelector('.btn-primary, .btn-danger');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const btn = e.target.closest('button');
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;margin:0;border-width:2px"></span> در حال انجام...';
                    btn.disabled = true;
                    
                    try {
                        await options.onConfirm();
                        this.close();
                    } catch(err) {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }
                });
            }
        }

        const cancelBtns = this.footerEl.querySelectorAll('[data-dismiss="modal"]');
        cancelBtns.forEach(btn => btn.addEventListener('click', () => this.close()));

        this.overlay.classList.add('open');

        // فوکوس روی اولین ورودی
        setTimeout(() => {
            const firstInput = this.bodyEl.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) firstInput.focus();
        }, 100);
    },

    close() {
        if (this.overlay) {
            this.overlay.classList.remove('open');
        }
    },

    confirmDelete(options) {
        this.open({
            title: options.title || 'تایید حذف',
            body: `<p class="mb-4">${options.message || 'آیا از حذف این مورد اطمینان دارید؟ این عمل غیرقابل بازگشت است.'}</p>`,
            footer: `
                <button type="button" class="btn btn-ghost" data-dismiss="modal">انصراف</button>
                <button type="button" class="btn btn-danger">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    حذف قطعی
                </button>
            `,
            onConfirm: options.onConfirm
        });
    }
};
