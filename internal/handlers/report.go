package handlers

import (
	"time"

	"vpn-accounting/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ReportHandler struct {
	db *gorm.DB
}

func NewReportHandler(db *gorm.DB) *ReportHandler {
	return &ReportHandler{db: db}
}

// Daily — گزارش روزانه
func (h *ReportHandler) Daily(c *fiber.Ctx) error {
	dateStr := c.Query("date", time.Now().Format("2006-01-02"))
	date, _ := time.Parse("2006-01-02", dateStr)
	nextDay := date.AddDate(0, 0, 1)

	var revenue, expenses int64
	h.db.Model(&models.Revenue{}).Where("date >= ? AND date < ?", date, nextDay).
		Select("COALESCE(SUM(amount), 0)").Scan(&revenue)
	h.db.Model(&models.Expense{}).Where("date >= ? AND date < ?", date, nextDay).
		Select("COALESCE(SUM(amount), 0)").Scan(&expenses)

	var transactions []models.Transaction
	h.db.Preload("BankAccount").Preload("Reseller").
		Where("date >= ? AND date < ?", date, nextDay).
		Order("date desc").Find(&transactions)

	return c.JSON(fiber.Map{
		"date":         dateStr,
		"revenue":      revenue,
		"expenses":     expenses,
		"profit":       revenue - expenses,
		"transactions": transactions,
	})
}

// Weekly — گزارش هفتگی
func (h *ReportHandler) Weekly(c *fiber.Ctx) error {
	now := time.Now()
	weekStart := now.AddDate(0, 0, -int(now.Weekday()))
	weekStart = time.Date(weekStart.Year(), weekStart.Month(), weekStart.Day(), 0, 0, 0, 0, now.Location())

	type DailyEntry struct {
		Date    string `json:"date"`
		Revenue int64  `json:"revenue"`
		Expense int64  `json:"expense"`
		Profit  int64  `json:"profit"`
	}

	var dailyRevenues []DailyEntry
	h.db.Raw(`
		SELECT strftime('%Y-%m-%d', date) as date, SUM(amount) as revenue
		FROM revenues WHERE date >= ?
		GROUP BY strftime('%Y-%m-%d', date) ORDER BY date
	`, weekStart).Scan(&dailyRevenues)

	var dailyExpenses []struct {
		Date    string
		Expense int64
	}
	h.db.Raw(`
		SELECT strftime('%Y-%m-%d', date) as date, SUM(amount) as expense
		FROM expenses WHERE date >= ?
		GROUP BY strftime('%Y-%m-%d', date) ORDER BY date
	`, weekStart).Scan(&dailyExpenses)

	var totalRevenue, totalExpense int64
	h.db.Model(&models.Revenue{}).Where("date >= ?", weekStart).Select("COALESCE(SUM(amount), 0)").Scan(&totalRevenue)
	h.db.Model(&models.Expense{}).Where("date >= ?", weekStart).Select("COALESCE(SUM(amount), 0)").Scan(&totalExpense)

	return c.JSON(fiber.Map{
		"week_start":    weekStart.Format("2006-01-02"),
		"total_revenue": totalRevenue,
		"total_expense": totalExpense,
		"profit":        totalRevenue - totalExpense,
		"daily_data":    dailyRevenues,
	})
}

// Monthly — گزارش ماهانه
func (h *ReportHandler) Monthly(c *fiber.Ctx) error {
	monthStr := c.Query("month", time.Now().Format("2006-01"))
	monthStart, _ := time.Parse("2006-01", monthStr)
	monthEnd := monthStart.AddDate(0, 1, 0)

	var revenue, expenses int64
	h.db.Model(&models.Revenue{}).Where("date >= ? AND date < ?", monthStart, monthEnd).
		Select("COALESCE(SUM(amount), 0)").Scan(&revenue)
	h.db.Model(&models.Expense{}).Where("date >= ? AND date < ?", monthStart, monthEnd).
		Select("COALESCE(SUM(amount), 0)").Scan(&expenses)

	type DailyData struct {
		Date   string `json:"date"`
		Amount int64  `json:"amount"`
	}
	var dailyRevenue, dailyExpense []DailyData
	h.db.Raw(`
		SELECT strftime('%Y-%m-%d', date) as date, SUM(amount) as amount
		FROM revenues WHERE date >= ? AND date < ?
		GROUP BY strftime('%Y-%m-%d', date) ORDER BY date
	`, monthStart, monthEnd).Scan(&dailyRevenue)
	h.db.Raw(`
		SELECT strftime('%Y-%m-%d', date) as date, SUM(amount) as amount
		FROM expenses WHERE date >= ? AND date < ?
		GROUP BY strftime('%Y-%m-%d', date) ORDER BY date
	`, monthStart, monthEnd).Scan(&dailyExpense)

	return c.JSON(fiber.Map{
		"month":         monthStr,
		"revenue":       revenue,
		"expenses":      expenses,
		"profit":        revenue - expenses,
		"daily_revenue": dailyRevenue,
		"daily_expense": dailyExpense,
	})
}

// ProfitLoss — سود و زیان
func (h *ReportHandler) ProfitLoss(c *fiber.Ctx) error {
	var totalRevenue, totalExpense int64
	h.db.Model(&models.Revenue{}).Select("COALESCE(SUM(amount), 0)").Scan(&totalRevenue)
	h.db.Model(&models.Expense{}).Select("COALESCE(SUM(amount), 0)").Scan(&totalExpense)

	type SourceBreakdown struct {
		Source string `json:"source"`
		Total  int64  `json:"total"`
	}
	var revBreakdown []SourceBreakdown
	h.db.Raw(`SELECT source, SUM(amount) as total FROM revenues GROUP BY source`).Scan(&revBreakdown)

	type CatBreakdown struct {
		Category string `json:"category"`
		Total    int64  `json:"total"`
	}
	var expBreakdown []CatBreakdown
	h.db.Raw(`
		SELECT COALESCE(ec.name, 'سایر') as category, SUM(e.amount) as total
		FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
		GROUP BY ec.name ORDER BY total DESC
	`).Scan(&expBreakdown)

	type MonthlyTrend struct {
		Month  string `json:"month"`
		Profit int64  `json:"profit"`
	}
	var profitTrend []MonthlyTrend
	h.db.Raw(`
		SELECT m.month, COALESCE(r.total, 0) - COALESCE(e.total, 0) as profit
		FROM (SELECT DISTINCT strftime('%Y-%m', date) as month FROM revenues UNION SELECT DISTINCT strftime('%Y-%m', date) FROM expenses) m
		LEFT JOIN (SELECT strftime('%Y-%m', date) as month, SUM(amount) as total FROM revenues GROUP BY strftime('%Y-%m', date)) r ON m.month = r.month
		LEFT JOIN (SELECT strftime('%Y-%m', date) as month, SUM(amount) as total FROM expenses GROUP BY strftime('%Y-%m', date)) e ON m.month = e.month
		ORDER BY m.month DESC LIMIT 12
	`).Scan(&profitTrend)

	return c.JSON(fiber.Map{
		"gross_revenue":     totalRevenue,
		"total_expenses":    totalExpense,
		"net_profit":        totalRevenue - totalExpense,
		"revenue_breakdown": revBreakdown,
		"expense_breakdown": expBreakdown,
		"profit_trend":      profitTrend,
	})
}

// ResellerReport — گزارش نماینده
func (h *ReportHandler) ResellerReport(c *fiber.Ctx) error {
	id := c.Params("id")

	var reseller models.Reseller
	if err := h.db.First(&reseller, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "نماینده یافت نشد"})
	}

	var totalSales, totalSettled int64
	h.db.Model(&models.ResellerLedger{}).Where("reseller_id = ? AND type = 'sale'", id).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalSales)
	h.db.Model(&models.Settlement{}).Where("reseller_id = ?", id).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalSettled)

	var lastLedger models.ResellerLedger
	h.db.Where("reseller_id = ?", id).Order("id desc").First(&lastLedger)

	var ledger []models.ResellerLedger
	h.db.Where("reseller_id = ?", id).Order("date desc").Limit(50).Find(&ledger)

	return c.JSON(fiber.Map{
		"reseller":         reseller,
		"total_sales":      totalSales,
		"total_settlements": totalSettled,
		"balance":          lastLedger.RunningBalance,
		"ledger":           ledger,
	})
}

// BankReport — گزارش بانک
func (h *ReportHandler) BankReport(c *fiber.Ctx) error {
	id := c.Params("id")

	var bank models.BankAccount
	if err := h.db.First(&bank, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "حساب یافت نشد"})
	}

	var deposits, withdrawals int64
	h.db.Model(&models.AccountingEntry{}).
		Where("account_type = 'bank' AND account_id = ? AND debit_amount > 0", id).
		Select("COALESCE(SUM(debit_amount), 0)").Scan(&deposits)
	h.db.Model(&models.AccountingEntry{}).
		Where("account_type = 'bank' AND account_id = ? AND credit_amount > 0", id).
		Select("COALESCE(SUM(credit_amount), 0)").Scan(&withdrawals)

	var transactions []models.Transaction
	h.db.Where("bank_account_id = ?", id).Order("date desc").Limit(50).Find(&transactions)

	return c.JSON(fiber.Map{
		"bank":          bank,
		"total_deposits":    deposits,
		"total_withdrawals": withdrawals,
		"transactions":      transactions,
	})
}

// ExpenseAnalysis — تحلیل هزینه‌ها
func (h *ReportHandler) ExpenseAnalysis(c *fiber.Ctx) error {
	type CatData struct {
		Category string `json:"category"`
		Total    int64  `json:"total"`
		Count    int64  `json:"count"`
	}
	var byCategory []CatData
	h.db.Raw(`
		SELECT COALESCE(ec.name, 'سایر') as category, SUM(e.amount) as total, COUNT(*) as count
		FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
		GROUP BY ec.name ORDER BY total DESC
	`).Scan(&byCategory)

	type MonthData struct {
		Month string `json:"month"`
		Total int64  `json:"total"`
	}
	var monthly []MonthData
	h.db.Raw(`
		SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
		FROM expenses GROUP BY strftime('%Y-%m', date)
		ORDER BY month DESC LIMIT 12
	`).Scan(&monthly)

	return c.JSON(fiber.Map{
		"by_category": byCategory,
		"monthly":     monthly,
	})
}
