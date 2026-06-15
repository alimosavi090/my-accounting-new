package models

import (
	"time"
)

// BankAccount — حساب‌های بانکی
type BankAccount struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Title         string    `gorm:"not null" json:"title"`
	BankName      string    `gorm:"not null" json:"bank_name"`
	CardNumber    string    `json:"card_number"`
	AccountNumber string    `json:"account_number"`
	Balance       int64     `json:"balance"`
	Notes         string    `json:"notes"`
	Status        string    `gorm:"default:'active'" json:"status"` // active / inactive
	Color         string    `json:"color"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// ExpenseCategory — دسته‌بندی هزینه‌ها
type ExpenseCategory struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"not null" json:"name"`
	Type      string    `gorm:"not null" json:"type"` // iranian_server / iranian_bandwidth / foreign_server / arvancloud / custom
	Icon      string    `json:"icon"`
	Color     string    `json:"color"`
	IsSystem  bool      `gorm:"default:false" json:"is_system"`
	CreatedAt time.Time `json:"created_at"`
}

// Revenue — درآمدها
type Revenue struct {
	ID             uint         `gorm:"primaryKey" json:"id"`
	Source         string       `gorm:"not null" json:"source"` // zarinpal / card_to_card / manual
	Amount         int64        `gorm:"not null" json:"amount"`
	TransactionRef string       `json:"transaction_ref"` // شماره تراکنش زرین‌پال
	SourceCard     string       `json:"source_card"`     // شماره کارت مبدا (کارت به کارت)
	BankAccountID  *uint        `json:"bank_account_id"`
	BankAccount    *BankAccount `gorm:"foreignKey:BankAccountID" json:"bank_account,omitempty"`
	CategoryName   string       `json:"category_name"` // دسته‌بندی دستی
	Date           time.Time    `gorm:"not null" json:"date"`
	Notes          string       `json:"notes"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
}

// Expense — هزینه‌ها
type Expense struct {
	ID            uint             `gorm:"primaryKey" json:"id"`
	Title         string           `gorm:"not null" json:"title"`
	CategoryID    *uint            `json:"category_id"`
	Category      *ExpenseCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Provider      string           `json:"provider"`
	Amount        int64            `gorm:"not null" json:"amount"`
	BankAccountID *uint            `json:"bank_account_id"`
	BankAccount   *BankAccount     `gorm:"foreignKey:BankAccountID" json:"bank_account,omitempty"`
	Date          time.Time        `gorm:"not null" json:"date"`
	RenewalDate   *time.Time       `json:"renewal_date"`
	ServicePeriod string           `json:"service_period"`
	Notes         string           `json:"notes"`
	IsPaid        bool             `gorm:"default:true" json:"is_paid"`
	CreatedAt     time.Time        `json:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at"`
}

// Reseller — نمایندگان فروش
type Reseller struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	FullName         string    `gorm:"not null" json:"full_name"`
	Mobile           string    `json:"mobile"`
	TelegramID       string    `json:"telegram_id"`
	Status           string    `gorm:"default:'active'" json:"status"` // active / inactive
	Notes            string    `json:"notes"`
	RegistrationDate time.Time `json:"registration_date"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// ResellerLedger — دفتر کل نماینده
type ResellerLedger struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	ResellerID     uint      `gorm:"not null;index" json:"reseller_id"`
	Reseller       Reseller  `gorm:"foreignKey:ResellerID" json:"reseller,omitempty"`
	Type           string    `gorm:"not null" json:"type"` // sale / settlement / debit_adjust / credit_adjust / correction
	Amount         int64     `gorm:"not null" json:"amount"`
	RunningBalance int64     `json:"running_balance"`
	Description    string    `json:"description"`
	Date           time.Time `gorm:"not null" json:"date"`
	CreatedAt      time.Time `json:"created_at"`
}

// Settlement — تسویه حساب نمایندگان
type Settlement struct {
	ID            uint         `gorm:"primaryKey" json:"id"`
	ResellerID    uint         `gorm:"not null;index" json:"reseller_id"`
	Reseller      Reseller     `gorm:"foreignKey:ResellerID" json:"reseller,omitempty"`
	Amount        int64        `gorm:"not null" json:"amount"`
	BankAccountID *uint        `json:"bank_account_id"`
	BankAccount   *BankAccount `gorm:"foreignKey:BankAccountID" json:"bank_account,omitempty"`
	Date          time.Time    `gorm:"not null" json:"date"`
	Notes         string       `json:"notes"`
	CreatedAt     time.Time    `json:"created_at"`
}

// Transaction — تراکنش‌های عمومی
type Transaction struct {
	ID            uint         `gorm:"primaryKey" json:"id"`
	TxNumber      string       `gorm:"uniqueIndex;not null" json:"tx_number"`
	Type          string       `gorm:"not null;index" json:"type"` // revenue / expense / transfer / settlement / adjustment
	Amount        int64        `gorm:"not null" json:"amount"`
	Date          time.Time    `gorm:"not null;index" json:"date"`
	BankAccountID *uint        `json:"bank_account_id"`
	BankAccount   *BankAccount `gorm:"foreignKey:BankAccountID" json:"bank_account,omitempty"`
	ResellerID    *uint        `json:"reseller_id"`
	Reseller      *Reseller    `gorm:"foreignKey:ResellerID" json:"reseller,omitempty"`
	Description   string       `json:"description"`
	Creator       string       `json:"creator"`
	CreatedAt     time.Time    `json:"created_at"`
}

// AccountingEntry — ثبت‌های حسابداری دوبل
type AccountingEntry struct {
	ID            uint        `gorm:"primaryKey" json:"id"`
	TransactionID uint        `gorm:"not null;index" json:"transaction_id"`
	Transaction   Transaction `gorm:"foreignKey:TransactionID" json:"transaction,omitempty"`
	AccountType   string      `gorm:"not null" json:"account_type"` // revenue / expense / bank / reseller
	AccountID     uint        `json:"account_id"`
	DebitAmount   int64       `json:"debit_amount"`
	CreditAmount  int64       `json:"credit_amount"`
	Description   string      `json:"description"`
	Date          time.Time   `json:"date"`
	CreatedAt     time.Time   `json:"created_at"`
}

// ProfitLossSnapshot — عکس روزانه سود و زیان
type ProfitLossSnapshot struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	Date               time.Time `gorm:"uniqueIndex;not null" json:"date"`
	TotalRevenue       int64     `json:"total_revenue"`
	TotalExpenses      int64     `json:"total_expenses"`
	NetProfit          int64     `json:"net_profit"`
	BankTotal          int64     `json:"bank_total"`
	ResellerDebtTotal  int64     `json:"reseller_debt_total"`
	ResellerCreditTotal int64    `json:"reseller_credit_total"`
	CreatedAt          time.Time `json:"created_at"`
}

// AuditLog — لاگ تغییرات
type AuditLog struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	EntityType    string    `gorm:"not null;index" json:"entity_type"`
	EntityID      uint      `gorm:"not null" json:"entity_id"`
	Action        string    `gorm:"not null" json:"action"` // create / update / delete
	User          string    `json:"user"`
	PreviousValue string    `gorm:"type:text" json:"previous_value"`
	NewValue      string    `gorm:"type:text" json:"new_value"`
	CreatedAt     time.Time `json:"created_at"`
}

// Setting — تنظیمات سیستم
type Setting struct {
	ID    uint   `gorm:"primaryKey" json:"id"`
	Key   string `gorm:"uniqueIndex;not null" json:"key"`
	Value string `json:"value"`
}
