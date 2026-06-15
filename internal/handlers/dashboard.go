package handlers

import (
	"fmt"
	"time"

	"vpn-accounting/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type DashboardHandler struct {
	db *gorm.DB
}

func NewDashboardHandler(db *gorm.DB) *DashboardHandler {
	return &DashboardHandler{db: db}
}

// Summary — شاخص‌های کلیدی مالی
func (h *DashboardHandler) Summary(c *fiber.Ctx) error {
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	var totalBankBalance int64
	h.db.Model(&models.BankAccount{}).Where("status = 'active'").Select("COALESCE(SUM(balance), 0)").Scan(&totalBankBalance)

	var todayRevenue, todayExpense int64
	h.db.Model(&models.Revenue{}).Where("date >= ?", todayStart).Select("COALESCE(SUM(amount), 0)").Scan(&todayRevenue)
	h.db.Model(&models.Expense{}).Where("date >= ?", todayStart).Select("COALESCE(SUM(amount), 0)").Scan(&todayExpense)

	var monthRevenue, monthExpense int64
	h.db.Model(&models.Revenue{}).Where("date >= ?", monthStart).Select("COALESCE(SUM(amount), 0)").Scan(&monthRevenue)
	h.db.Model(&models.Expense{}).Where("date >= ?", monthStart).Select("COALESCE(SUM(amount), 0)").Scan(&monthExpense)

	var totalRevenue, totalExpense int64
	h.db.Model(&models.Revenue{}).Select("COALESCE(SUM(amount), 0)").Scan(&totalRevenue)
	h.db.Model(&models.Expense{}).Select("COALESCE(SUM(amount), 0)").Scan(&totalExpense)

	return c.JSON(fiber.Map{
		"total_bank_balance": totalBankBalance,
		"today_revenue":      todayRevenue,
		"today_expenses":     todayExpense,
		"today_profit":       todayRevenue - todayExpense,
		"month_revenue":      monthRevenue,
		"month_expenses":     monthExpense,
		"month_profit":       monthRevenue - monthExpense,
		"total_revenue":      totalRevenue,
		"total_expenses":     totalExpense,
		"net_profit":         totalRevenue - totalExpense,
	})
}

// ResellerStatus — وضعیت مالی نمایندگان
func (h *DashboardHandler) ResellerStatus(c *fiber.Ctx) error {
	type ResellerBalance struct {
		ResellerID     uint
		RunningBalance int64
	}

	var balances []ResellerBalance
	h.db.Raw(`
		SELECT reseller_id, running_balance
		FROM reseller_ledgers
		WHERE id IN (SELECT MAX(id) FROM reseller_ledgers GROUP BY reseller_id)
	`).Scan(&balances)

	var totalDebt, totalCredit int64
	var debtorCount, creditorCount int

	for _, b := range balances {
		if b.RunningBalance > 0 {
			totalDebt += b.RunningBalance
			debtorCount++
		} else if b.RunningBalance < 0 {
			totalCredit += -b.RunningBalance
			creditorCount++
		}
	}

	return c.JSON(fiber.Map{
		"total_debt":      totalDebt,
		"total_credit":    totalCredit,
		"net_receivables": totalDebt - totalCredit,
		"debtor_count":    debtorCount,
		"creditor_count":  creditorCount,
	})
}

// BankOverview — وضعیت حساب‌های بانکی
func (h *DashboardHandler) BankOverview(c *fiber.Ctx) error {
	var banks []models.BankAccount
	h.db.Where("status = 'active'").Find(&banks)

	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	var incoming, outgoing int64
	h.db.Model(&models.Transaction{}).Where("type IN ('revenue','adjustment') AND date >= ? AND amount > 0", monthStart).
		Select("COALESCE(SUM(amount), 0)").Scan(&incoming)
	h.db.Model(&models.Transaction{}).Where("type IN ('expense','settlement') AND date >= ?", monthStart).
		Select("COALESCE(SUM(amount), 0)").Scan(&outgoing)

	return c.JSON(fiber.Map{
		"banks":    banks,
		"incoming": incoming,
		"outgoing": outgoing,
		"net_flow": incoming - outgoing,
	})
}

// Charts — داده‌های نمودار
func (h *DashboardHandler) Charts(c *fiber.Ctx) error {
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

	type DailyData struct {
		Date   string `json:"date"`
		Amount int64  `json:"amount"`
	}

	var revenueTrend []DailyData
	h.db.Raw(`
		SELECT strftime('%Y-%m-%d', date) as date, SUM(amount) as amount
		FROM revenues WHERE date >= ?
		GROUP BY strftime('%Y-%m-%d', date)
		ORDER BY date
	`, thirtyDaysAgo).Scan(&revenueTrend)

	var expenseTrend []DailyData
	h.db.Raw(`
		SELECT strftime('%Y-%m-%d', date) as date, SUM(amount) as amount
		FROM expenses WHERE date >= ?
		GROUP BY strftime('%Y-%m-%d', date)
		ORDER BY date
	`, thirtyDaysAgo).Scan(&expenseTrend)

	type SourceBreakdown struct {
		Source string `json:"source"`
		Total  int64  `json:"total"`
	}
	var revenueBySource []SourceBreakdown
	h.db.Raw(`SELECT source, SUM(amount) as total FROM revenues GROUP BY source`).Scan(&revenueBySource)

	type CategoryBreakdown struct {
		Category string `json:"category"`
		Total    int64  `json:"total"`
	}
	var expenseByCategory []CategoryBreakdown
	h.db.Raw(`
		SELECT COALESCE(ec.name, 'سایر') as category, SUM(e.amount) as total
		FROM expenses e
		LEFT JOIN expense_categories ec ON e.category_id = ec.id
		GROUP BY ec.name
	`).Scan(&expenseByCategory)

	type MonthlyPerf struct {
		Month    string `json:"month"`
		Revenue  int64  `json:"revenue"`
		Expenses int64  `json:"expenses"`
		Profit   int64  `json:"profit"`
	}
	var monthlyPerf []MonthlyPerf
	h.db.Raw(`
		SELECT m.month,
			COALESCE(r.total, 0) as revenue,
			COALESCE(e.total, 0) as expenses,
			COALESCE(r.total, 0) - COALESCE(e.total, 0) as profit
		FROM (
			SELECT DISTINCT strftime('%Y-%m', date) as month FROM revenues
			UNION
			SELECT DISTINCT strftime('%Y-%m', date) FROM expenses
		) m
		LEFT JOIN (SELECT strftime('%Y-%m', date) as month, SUM(amount) as total FROM revenues GROUP BY strftime('%Y-%m', date)) r ON m.month = r.month
		LEFT JOIN (SELECT strftime('%Y-%m', date) as month, SUM(amount) as total FROM expenses GROUP BY strftime('%Y-%m', date)) e ON m.month = e.month
		ORDER BY m.month DESC LIMIT 6
	`).Scan(&monthlyPerf)

	return c.JSON(fiber.Map{
		"revenue_trend":       revenueTrend,
		"expense_trend":       expenseTrend,
		"revenue_by_source":   revenueBySource,
		"expense_by_category": expenseByCategory,
		"monthly_performance": monthlyPerf,
	})
}

// TopResellers — نمایندگان برتر
func (h *DashboardHandler) TopResellers(c *fiber.Ctx) error {
	type TopSeller struct {
		ID       uint   `json:"id"`
		FullName string `json:"full_name"`
		Total    int64  `json:"total"`
	}

	var topSellers []TopSeller
	h.db.Raw(`
		SELECT r.id, r.full_name, COALESCE(SUM(rl.amount), 0) as total
		FROM resellers r
		LEFT JOIN reseller_ledgers rl ON r.id = rl.reseller_id AND rl.type = 'sale'
		GROUP BY r.id
		ORDER BY total DESC
		LIMIT 5
	`).Scan(&topSellers)

	type TopDebtor struct {
		ID       uint   `json:"id"`
		FullName string `json:"full_name"`
		Balance  int64  `json:"balance"`
	}

	var topDebtors []TopDebtor
	h.db.Raw(`
		SELECT r.id, r.full_name, rl.running_balance as balance
		FROM resellers r
		JOIN reseller_ledgers rl ON r.id = rl.reseller_id
		WHERE rl.id IN (SELECT MAX(id) FROM reseller_ledgers GROUP BY reseller_id)
		AND rl.running_balance > 0
		ORDER BY rl.running_balance DESC
		LIMIT 5
	`).Scan(&topDebtors)

	return c.JSON(fiber.Map{
		"top_sellers": topSellers,
		"top_debtors": topDebtors,
	})
}

// RecentActivity — فعالیت‌های اخیر
func (h *DashboardHandler) RecentActivity(c *fiber.Ctx) error {
	var recentTx []models.Transaction
	h.db.Preload("BankAccount").Preload("Reseller").
		Order("created_at desc").Limit(10).Find(&recentTx)

	var recentExpenses []models.Expense
	h.db.Preload("Category").Preload("BankAccount").
		Order("created_at desc").Limit(5).Find(&recentExpenses)

	var recentSettlements []models.Settlement
	h.db.Preload("Reseller").Preload("BankAccount").
		Order("created_at desc").Limit(5).Find(&recentSettlements)

	return c.JSON(fiber.Map{
		"recent_transactions": recentTx,
		"recent_expenses":     recentExpenses,
		"recent_settlements":  recentSettlements,
	})
}

// Alerts — هشدارهای مالی
func (h *DashboardHandler) Alerts(c *fiber.Ctx) error {
	type Alert struct {
		Type    string `json:"type"`
		Title   string `json:"title"`
		Message string `json:"message"`
		Level   string `json:"level"`
	}

	var alerts []Alert

	type DebtorInfo struct {
		FullName string
		Balance  int64
	}
	var bigDebtors []DebtorInfo
	h.db.Raw(`
		SELECT r.full_name, rl.running_balance as balance
		FROM resellers r
		JOIN reseller_ledgers rl ON r.id = rl.reseller_id
		WHERE rl.id IN (SELECT MAX(id) FROM reseller_ledgers GROUP BY reseller_id)
		AND rl.running_balance > 10000000
		ORDER BY rl.running_balance DESC
	`).Scan(&bigDebtors)
	for _, d := range bigDebtors {
		alerts = append(alerts, Alert{
			Type:    "debt",
			Title:   "بدهی بالای نماینده",
			Message: fmt.Sprintf("%s - بدهی: %d تومان", d.FullName, d.Balance),
			Level:   "danger",
		})
	}

	var unpaidCount int64
	h.db.Model(&models.Expense{}).Where("is_paid = false").Count(&unpaidCount)
	if unpaidCount > 0 {
		alerts = append(alerts, Alert{
			Type:    "unpaid",
			Title:   "هزینه‌های پرداخت نشده",
			Message: fmt.Sprintf("تعداد %d هزینه پرداخت نشده", unpaidCount),
			Level:   "warning",
		})
	}

	sevenDaysLater := time.Now().AddDate(0, 0, 7)
	var renewalExpenses []models.Expense
	h.db.Where("renewal_date IS NOT NULL AND renewal_date <= ? AND renewal_date >= ?",
		sevenDaysLater, time.Now()).Find(&renewalExpenses)
	for _, exp := range renewalExpenses {
		alerts = append(alerts, Alert{
			Type:    "renewal",
			Title:   "تمدید نزدیک",
			Message: fmt.Sprintf("%s - تاریخ تمدید: %s", exp.Title, exp.RenewalDate.Format("2006-01-02")),
			Level:   "warning",
		})
	}

	if alerts == nil {
		alerts = []Alert{}
	}

	return c.JSON(alerts)
}
