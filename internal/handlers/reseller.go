package handlers

import (
	"strconv"
	"time"

	"vpn-accounting/internal/models"
	"vpn-accounting/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ResellerHandler struct {
	db         *gorm.DB
	accounting *services.AccountingService
}

func NewResellerHandler(db *gorm.DB, acc *services.AccountingService) *ResellerHandler {
	return &ResellerHandler{db: db, accounting: acc}
}

func (h *ResellerHandler) List(c *fiber.Ctx) error {
	type ResellerWithBalance struct {
		models.Reseller
		Balance        int64 `json:"balance"`
		TotalSales     int64 `json:"total_sales"`
		TotalSettled   int64 `json:"total_settled"`
	}

	var resellers []models.Reseller
	h.db.Order("full_name asc").Find(&resellers)

	var result []ResellerWithBalance
	for _, r := range resellers {
		var lastLedger models.ResellerLedger
		h.db.Where("reseller_id = ?", r.ID).Order("id desc").First(&lastLedger)

		var totalSales int64
		h.db.Model(&models.ResellerLedger{}).Where("reseller_id = ? AND type = 'sale'", r.ID).
			Select("COALESCE(SUM(amount), 0)").Scan(&totalSales)

		var totalSettled int64
		h.db.Model(&models.Settlement{}).Where("reseller_id = ?", r.ID).
			Select("COALESCE(SUM(amount), 0)").Scan(&totalSettled)

		result = append(result, ResellerWithBalance{
			Reseller:     r,
			Balance:      lastLedger.RunningBalance,
			TotalSales:   totalSales,
			TotalSettled: totalSettled,
		})
	}

	if result == nil {
		result = []ResellerWithBalance{}
	}

	return c.JSON(result)
}

func (h *ResellerHandler) Get(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var reseller models.Reseller
	if err := h.db.First(&reseller, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "نماینده یافت نشد"})
	}

	var lastLedger models.ResellerLedger
	h.db.Where("reseller_id = ?", id).Order("id desc").First(&lastLedger)

	var totalSales, totalSettled, totalRevenue int64
	h.db.Model(&models.ResellerLedger{}).Where("reseller_id = ? AND type = 'sale'", id).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalSales)
	h.db.Model(&models.Settlement{}).Where("reseller_id = ?", id).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalSettled)
	h.db.Model(&models.ResellerLedger{}).Where("reseller_id = ? AND type = 'sale'", id).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalRevenue)

	var lastSettlement models.Settlement
	h.db.Where("reseller_id = ?", id).Order("date desc").First(&lastSettlement)

	balance := lastLedger.RunningBalance
	var debt, credit int64
	if balance > 0 {
		debt = balance
	} else {
		credit = -balance
	}

	return c.JSON(fiber.Map{
		"reseller":          reseller,
		"balance":           balance,
		"debt":              debt,
		"credit":            credit,
		"total_sales":       totalSales,
		"total_settlements": totalSettled,
		"total_revenue":     totalRevenue,
		"last_settlement":   lastSettlement.Date,
	})
}

func (h *ResellerHandler) Create(c *fiber.Ctx) error {
	var reseller models.Reseller
	if err := c.BodyParser(&reseller); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}
	if reseller.RegistrationDate.IsZero() {
		reseller.RegistrationDate = time.Now()
	}
	if reseller.Status == "" {
		reseller.Status = "active"
	}
	h.db.Create(&reseller)
	return c.Status(201).JSON(reseller)
}

func (h *ResellerHandler) Update(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var reseller models.Reseller
	if err := h.db.First(&reseller, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "نماینده یافت نشد"})
	}

	var input models.Reseller
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}

	h.db.Model(&reseller).Updates(map[string]interface{}{
		"full_name":   input.FullName,
		"mobile":      input.Mobile,
		"telegram_id": input.TelegramID,
		"status":      input.Status,
		"notes":       input.Notes,
	})

	h.db.First(&reseller, id)
	return c.JSON(reseller)
}

func (h *ResellerHandler) Delete(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var reseller models.Reseller
	if err := h.db.First(&reseller, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "نماینده یافت نشد"})
	}
	h.db.Delete(&reseller)
	return c.JSON(fiber.Map{"message": "حذف شد"})
}

// Ledger — دفتر کل نماینده
func (h *ResellerHandler) Ledger(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	query := h.db.Where("reseller_id = ?", id).Order("date desc, id desc")

	if txType := c.Query("type"); txType != "" {
		query = query.Where("type = ?", txType)
	}
	if from := c.Query("from"); from != "" {
		query = query.Where("date >= ?", from)
	}
	if to := c.Query("to"); to != "" {
		query = query.Where("date <= ?", to)
	}

	var ledger []models.ResellerLedger
	query.Find(&ledger)
	return c.JSON(ledger)
}

// RecordSale — ثبت فروش نماینده
func (h *ResellerHandler) RecordSale(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var input struct {
		Amount      int64  `json:"amount"`
		Description string `json:"description"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}

	if err := h.accounting.RecordResellerSale(uint(id), input.Amount, time.Now(), input.Description); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "فروش ثبت شد"})
}

// Adjust — تعدیل بدهی/اعتبار
func (h *ResellerHandler) Adjust(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var input struct {
		Amount      int64  `json:"amount"`
		Type        string `json:"type"` // debit_adjust / credit_adjust
		Description string `json:"description"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}

	if err := h.accounting.RecordResellerAdjustment(uint(id), input.Amount, input.Type, time.Now(), input.Description); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "تعدیل انجام شد"})
}
