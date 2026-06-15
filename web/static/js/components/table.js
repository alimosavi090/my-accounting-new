// components/table.js

class TableBuilder {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.columns = [];
        this.data = [];
        this.actions = null;
        this.emptyMessage = 'داده‌ای برای نمایش وجود ندارد';
    }

    setColumns(columns) {
        this.columns = columns;
        return this;
    }

    setData(data) {
        this.data = data || [];
        return this;
    }

    setActions(renderFn) {
        this.actions = renderFn;
        return this;
    }

    setEmptyMessage(msg) {
        this.emptyMessage = msg;
        return this;
    }

    render() {
        if (!this.container) return;

        if (this.data.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <h3>${this.emptyMessage}</h3>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            ${this.columns.map(col => `<th>${col.label}</th>`).join('')}
                            ${this.actions ? '<th>عملیات</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.data.forEach(row => {
            html += `<tr>`;
            this.columns.map(col => {
                let val = row[col.key];
                // Nested keys like "BankAccount.Title"
                if (col.key && col.key.includes('.')) {
                    val = col.key.split('.').reduce((o, i) => (o ? o[i] : null), row);
                }

                let displayVal = val;
                if (col.render) {
                    displayVal = col.render(val, row);
                }

                html += `<td>${displayVal !== null && displayVal !== undefined ? displayVal : '-'}</td>`;
            });

            if (this.actions) {
                html += `<td><div class="table-actions">${this.actions(row)}</div></td>`;
            }

            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        this.container.innerHTML = html;
    }

    renderSkeleton(rowCount = 5) {
        if (!this.container) return;
        
        let html = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            ${this.columns.map(col => `<th>${col.label}</th>`).join('')}
                            ${this.actions ? '<th>عملیات</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
        `;

        for(let i=0; i<rowCount; i++) {
            html += `<tr>`;
            const colsToRender = this.actions ? this.columns.length + 1 : this.columns.length;
            for(let j=0; j<colsToRender; j++) {
                html += `<td><div class="skeleton" style="height: 16px; width: ${Math.random() * 40 + 40}%"></div></td>`;
            }
            html += `</tr>`;
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;

        this.container.innerHTML = html;
    }
}
