package handlers

import (
	"strconv"
	"strings"

	"vpn-accounting/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type SearchHandler struct {
	db *gorm.DB
}

func NewSearchHandler(db *gorm.DB) *SearchHandler {
	return &SearchHandler{db: db}
}

// Search — جستجوی سراسری
func (h *SearchHandler) Search(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		return c.JSON(fiber.Map{
			"resellers":    []interface{}{},
			"transactions": []interface{}{},
			"revenues":     []interface{}{},
			"expenses":     []interface{}{},
			"settlements":  []interface{}{},
			"banks":        []interface{}{},
		})
	}

	like := "%" + q + "%"
	limit := 10

	var resellers []models.Reseller
	h.db.Where("full_name LIKE ? OR mobile LIKE ? OR telegram_id LIKE ?", like, like, like).
		Limit(limit).Find(&resellers)

	var transactions []models.Transaction
	h.db.Preload("BankAccount").Preload("Reseller").
		Where("tx_number LIKE ? OR description LIKE ?", like, like).
		Limit(limit).Find(&transactions)

	var revenues []models.Revenue
	h.db.Preload("BankAccount").
		Where("transaction_ref LIKE ? OR notes LIKE ? OR source_card LIKE ?", like, like, like).
		Limit(limit).Find(&revenues)

	var expenses []models.Expense
	h.db.Preload("Category").
		Where("title LIKE ? OR provider LIKE ? OR notes LIKE ?", like, like, like).
		Limit(limit).Find(&expenses)

	var settlements []models.Settlement
	h.db.Preload("Reseller").Preload("BankAccount").
		Where("notes LIKE ?", like).
		Limit(limit).Find(&settlements)

	var banks []models.BankAccount
	h.db.Where("title LIKE ? OR bank_name LIKE ? OR card_number LIKE ? OR account_number LIKE ?", like, like, like, like).
		Limit(limit).Find(&banks)

	return c.JSON(fiber.Map{
		"resellers":    resellers,
		"transactions": transactions,
		"revenues":     revenues,
		"expenses":     expenses,
		"settlements":  settlements,
		"banks":        banks,
	})
}

// AuditLog handler
type AuditHandler struct {
	db *gorm.DB
}

func NewAuditHandler(db *gorm.DB) *AuditHandler {
	return &AuditHandler{db: db}
}

func (h *AuditHandler) List(c *fiber.Ctx) error {
	var logs []models.AuditLog
	query := h.db.Order("created_at desc")

	if entityType := c.Query("entity_type"); entityType != "" {
		query = query.Where("entity_type = ?", entityType)
	}
	if action := c.Query("action"); action != "" {
		query = query.Where("action = ?", action)
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.AuditLog{}).Count(&total)
	query.Offset(offset).Limit(limit).Find(&logs)

	return c.JSON(fiber.Map{
		"data":  logs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}
