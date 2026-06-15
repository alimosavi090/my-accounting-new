// charts.js

// تنظیمات پیش‌فرض Chart.js برای فونت فارسی و اعداد
Chart.defaults.font.family = "'Vazirmatn', system-ui, sans-serif";
Chart.defaults.color = "#8b8fa3";
Chart.defaults.plugins.tooltip.titleFont = { family: "'Vazirmatn'", size: 13, weight: 'bold' };
Chart.defaults.plugins.tooltip.bodyFont = { family: "'Vazirmatn'", size: 12 };
Chart.defaults.plugins.tooltip.rtl = true;
Chart.defaults.plugins.tooltip.textDirection = 'rtl';
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(17, 26, 46, 0.9)';
Chart.defaults.plugins.tooltip.titleColor = '#f0f0f5';
Chart.defaults.plugins.tooltip.bodyColor = '#f0f0f5';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 12;

// پلاگین برای تبدیل اعداد به فارسی در نمودار
Chart.defaults.plugins.tooltip.callbacks.label = function(context) {
    let label = context.dataset.label || '';
    if (label) {
        label += ': ';
    }
    if (context.parsed.y !== null) {
        label += Utils.formatMoney(context.parsed.y) + ' تومان';
    } else {
        label += Utils.toPersianNum(context.parsed);
    }
    return label;
};

// تابع کمکی برای ساخت نمودار لاین (ترند)
function createTrendChart(ctxId, label, labels, data, colorPrimary) {
    const ctx = document.getElementById(ctxId);
    if (!ctx) return null;

    // استخراج رنگ از متغیرهای CSS
    const computedStyle = getComputedStyle(document.body);
    const colorHex = computedStyle.getPropertyValue(colorPrimary).trim();
    
    // تبدیل هگز به RGB برای ساخت گرادیان
    const hex2rgb = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    };
    
    let rgb = '67, 97, 238'; // پیش‌فرض آبی
    try {
        rgb = hex2rgb(colorHex);
    } catch(e) {}

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, `rgba(${rgb}, 0.5)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0.0)`);

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(l => Utils.toPersianNum(l)),
            datasets: [{
                label: label,
                data: data,
                borderColor: colorHex,
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: colorHex,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: colorHex,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: {
                        callback: function(val, index) {
                            return this.getLabelForValue(val);
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000000) return Utils.toPersianNum(value / 1000000) + 'm';
                            if (value >= 1000) return Utils.toPersianNum(value / 1000) + 'k';
                            return Utils.toPersianNum(value);
                        }
                    }
                }
            }
        }
    });
}

// تابع کمکی برای ساخت نمودار دونات (تفکیک)
function createDonutChart(ctxId, labels, data, colors) {
    const ctx = document.getElementById(ctxId);
    if (!ctx) return null;

    const computedStyle = getComputedStyle(document.body);
    const resolvedColors = colors.map(c => computedStyle.getPropertyValue(c).trim() || c);

    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: resolvedColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'right',
                    rtl: true,
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { family: "'Vazirmatn'", size: 12 }
                    }
                }
            }
        }
    });
}
