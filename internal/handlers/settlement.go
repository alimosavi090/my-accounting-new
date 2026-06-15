package handlers

import (
	"strconv"
	"time"

	"vpn-accounting/internal/models"
	"vpn-accounting/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type SettlementHandler struct {
	db         *gorm.DB
	accounting *services.AccountingService
}

func NewSettlementHandler(db *gorm.DB, acc *services.AccountingService) *SettlementHandler {
	return &SettlementHandler{db: db, accounting: acc}
}

func (h *SettlementHandler) List(c *fiber.Ctx) error {
	var settlements []models.Settlement
	query := h.db.Preload("Reseller").Preload("BankAccount").Order("date desc")

	if resellerID := c.Query("reseller_id"); resellerID != "" {
		query = query.Where("reseller_id = ?", resellerID)
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
	query.Model(&models.Settlement{}).Count(&total)
	query.Offset(offset).Limit(limit).Find(&settlements)

	return c.JSON(fiber.Map{
		"data":  settlements,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *SettlementHandler) Create(c *fiber.Ctx) error {
	var settlement models.Settlement
	if err := c.BodyParser(&settlement); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}
	if settlement.Date.IsZero() {
		settlement.Date = time.Now()
	}

	if err := h.accounting.RecordSettlement(&settlement); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	h.db.Preload("Reseller").Preload("BankAccount").First(&settlement, settlement.ID)
	return c.Status(201).JSON(settlement)
}

func (h *SettlementHandler) ByReseller(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var settlements []models.Settlement
	h.db.Preload("BankAccount").Where("reseller_id = ?", id).
		Order("date desc").Find(&settlements)
	return c.JSON(settlements)
}
