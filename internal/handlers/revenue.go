package handlers

import (
	"strconv"
	"time"

	"vpn-accounting/internal/models"
	"vpn-accounting/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type RevenueHandler struct {
	db         *gorm.DB
	accounting *services.AccountingService
}

func NewRevenueHandler(db *gorm.DB, acc *services.AccountingService) *RevenueHandler {
	return &RevenueHandler{db: db, accounting: acc}
}

func (h *RevenueHandler) List(c *fiber.Ctx) error {
	var revenues []models.Revenue
	query := h.db.Preload("BankAccount").Order("date desc")

	if source := c.Query("source"); source != "" {
		query = query.Where("source = ?", source)
	}
	if from := c.Query("from"); from != "" {
		query = query.Where("date >= ?", from)
	}
	if to := c.Query("to"); to != "" {
		query = query.Where("date <= ?", to)
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.Revenue{}).Count(&total)
	query.Offset(offset).Limit(limit).Find(&revenues)

	return c.JSON(fiber.Map{
		"data":  revenues,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *RevenueHandler) Create(c *fiber.Ctx) error {
	var revenue models.Revenue
	if err := c.BodyParser(&revenue); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}
	if revenue.Date.IsZero() {
		revenue.Date = time.Now()
	}

	if err := h.accounting.RecordRevenue(&revenue); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	h.db.Preload("BankAccount").First(&revenue, revenue.ID)
	return c.Status(201).JSON(revenue)
}

func (h *RevenueHandler) Update(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var existing models.Revenue
	if err := h.db.First(&existing, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "درآمد یافت نشد"})
	}

	var input models.Revenue
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}

	// برگرداندن مبلغ قبلی از بانک
	if existing.BankAccountID != nil {
		h.db.Model(&models.BankAccount{}).Where("id = ?", *existing.BankAccountID).
			Update("balance", gorm.Expr("balance - ?", existing.Amount))
	}

	h.db.Model(&existing).Updates(input)

	// اعمال مبلغ جدید به بانک
	if existing.BankAccountID != nil {
		h.db.Model(&models.BankAccount{}).Where("id = ?", *existing.BankAccountID).
			Update("balance", gorm.Expr("balance + ?", existing.Amount))
	}

	h.db.Preload("BankAccount").First(&existing, id)
	return c.JSON(existing)
}

func (h *RevenueHandler) Delete(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var revenue models.Revenue
	if err := h.db.First(&revenue, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "درآمد یافت نشد"})
	}

	// برگرداندن مبلغ از بانک
	if revenue.BankAccountID != nil {
		h.db.Model(&models.BankAccount{}).Where("id = ?", *revenue.BankAccountID).
			Update("balance", gorm.Expr("balance - ?", revenue.Amount))
	}

	h.db.Delete(&revenue)
	return c.JSON(fiber.Map{"message": "حذف شد"})
}
