package handlers

import (
	"strconv"

	"vpn-accounting/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type TransactionHandler struct {
	db *gorm.DB
}

func NewTransactionHandler(db *gorm.DB) *TransactionHandler {
	return &TransactionHandler{db: db}
}

func (h *TransactionHandler) List(c *fiber.Ctx) error {
	var transactions []models.Transaction
	query := h.db.Preload("BankAccount").Preload("Reseller").Order("date desc")

	if txType := c.Query("type"); txType != "" {
		query = query.Where("type = ?", txType)
	}
	if from := c.Query("from"); from != "" {
		query = query.Where("date >= ?", from)
	}
	if to := c.Query("to"); to != "" {
		query = query.Where("date <= ?", to)
	}
	if search := c.Query("search"); search != "" {
		query = query.Where("description LIKE ? OR tx_number LIKE ?", "%"+search+"%", "%"+search+"%")
	}
	if bankID := c.Query("bank_account_id"); bankID != "" {
		query = query.Where("bank_account_id = ?", bankID)
	}
	if resellerID := c.Query("reseller_id"); resellerID != "" {
		query = query.Where("reseller_id = ?", resellerID)
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.Transaction{}).Count(&total)
	query.Offset(offset).Limit(limit).Find(&transactions)

	return c.JSON(fiber.Map{
		"data":  transactions,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *TransactionHandler) Get(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var tx models.Transaction
	if err := h.db.Preload("BankAccount").Preload("Reseller").First(&tx, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "تراکنش یافت نشد"})
	}

	var entries []models.AccountingEntry
	h.db.Where("transaction_id = ?", id).Find(&entries)

	return c.JSON(fiber.Map{
		"transaction": tx,
		"entries":     entries,
	})
}
