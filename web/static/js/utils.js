// utils.js

const Utils = {
    // تبدیل اعداد انگلیسی به فارسی
    toPersianNum(num) {
        if (num === null || num === undefined) return '';
        const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        return num.toString().replace(/\d/g, x => farsiDigits[x]);
    },

    // فرمت کردن پول (تومان)
    formatMoney(amount) {
        if (amount === null || amount === undefined) return '۰';
        const formatted = Math.abs(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        let result = this.toPersianNum(formatted);
        if (amount < 0) result = '-' + result;
        return result;
    },

    // فرمت تاریخ
    formatDate(dateStr, includeTime = false) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        return d.toLocaleDateString('fa-IR', options);
    },

    // ایجاد افکت افزایش عدد
    animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            // easeOutQuart
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(easeProgress * (end - start) + start);
            obj.innerHTML = this.formatMoney(current);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = this.formatMoney(end);
            }
        };
        window.requestAnimationFrame(step);
    },

    // ساخت آواتار از روی اسم
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return parts[0][0] + ' ' + parts[1][0];
        }
        return name.substring(0, 2);
    },

    // ارتباط با API
    async api(endpoint, options = {}) {
        const url = `/api/v1${endpoint}`;
        
        const token = localStorage.getItem('vpn_token');
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            defaultOptions.headers['Authorization'] = `Bearer ${token}`;
        }

        if (options.body && typeof options.body !== 'string') {
            options.body = JSON.stringify(options.body);
        }

        try {
            const res = await fetch(url, { ...defaultOptions, ...options });
            
            if (res.status === 401) {
                // توکن منقضی یا نامعتبر
                localStorage.removeItem('vpn_token');
                localStorage.removeItem('vpn_user');
                window.location.href = '/login.html';
                throw new Error('نشست شما پایان یافته است. لطفا مجددا وارد شوید.');
            }

            if (!res.ok) {
                let msg = 'خطای سرور';
                try {
                    const data = await res.json();
                    msg = data.error || msg;
                } catch(e) {}
                throw new Error(msg);
            }
            // اگر متد DELETE بود و محتوایی نداشت
            if (res.status === 204) return null;
            return await res.json();
        } catch (err) {
            console.error('API Error:', err);
            Toast.error(err.message);
            throw err;
        }
    }
};
