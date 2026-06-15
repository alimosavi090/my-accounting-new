package handlers

import (
	"strconv"
	"time"

	"vpn-accounting/internal/models"
	"vpn-accounting/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type BankHandler struct {
	db         *gorm.DB
	accounting *services.AccountingService
}

func NewBankHandler(db *gorm.DB, acc *services.AccountingService) *BankHandler {
	return &BankHandler{db: db, accounting: acc}
}

func (h *BankHandler) List(c *fiber.Ctx) error {
	var banks []models.BankAccount
	h.db.Order("created_at desc").Find(&banks)
	return c.JSON(banks)
}

func (h *BankHandler) Get(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var bank models.BankAccount
	if err := h.db.First(&bank, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "حساب یافت نشد"})
	}
	return c.JSON(bank)
}

func (h *BankHandler) Create(c *fiber.Ctx) error {
	var bank models.BankAccount
	if err := c.BodyParser(&bank); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}
	if bank.Status == "" {
		bank.Status = "active"
	}
	h.db.Create(&bank)
	return c.Status(201).JSON(bank)
}

func (h *BankHandler) Update(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var bank models.BankAccount
	if err := h.db.First(&bank, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "حساب یافت نشد"})
	}

	var input models.BankAccount
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}

	h.db.Model(&bank).Updates(map[string]interface{}{
		"title":          input.Title,
		"bank_name":      input.BankName,
		"card_number":    input.CardNumber,
		"account_number": input.AccountNumber,
		"notes":          input.Notes,
		"status":         input.Status,
		"color":          input.Color,
	})

	h.db.First(&bank, id)
	return c.JSON(bank)
}

func (h *BankHandler) Delete(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var bank models.BankAccount
	if err := h.db.First(&bank, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "حساب یافت نشد"})
	}
	h.db.Delete(&bank)
	return c.JSON(fiber.Map{"message": "حذف شد"})
}

// Deposit — واریز
func (h *BankHandler) Deposit(c *fiber.Ctx) error {
	var input struct {
		BankAccountID uint   `json:"bank_account_id"`
		Amount        int64  `json:"amount"`
		Notes         string `json:"notes"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}
	if err := h.accounting.RecordBankDeposit(input.BankAccountID, input.Amount, time.Now(), input.Notes); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "واریز انجام شد"})
}

// Withdraw — برداشت
func (h *BankHandler) Withdraw(c *fiber.Ctx) error {
	var input struct {
		BankAccountID uint   `json:"bank_account_id"`
		Amount        int64  `json:"amount"`
		Notes         string `json:"notes"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}
	if err := h.accounting.RecordBankWithdrawal(input.BankAccountID, input.Amount, time.Now(), input.Notes); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "برداشت انجام شد"})
}

// Transfer — انتقال بین حسابی
func (h *BankHandler) Transfer(c *fiber.Ctx) error {
	var input struct {
		SourceID uint   `json:"source_id"`
		DestID   uint   `json:"dest_id"`
		Amount   int64  `json:"amount"`
		Notes    string `json:"notes"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}
	if err := h.accounting.RecordBankTransfer(input.SourceID, input.DestID, input.Amount, time.Now(), input.Notes); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "انتقال انجام شد"})
}

// Transactions — تاریخچه تراکنش‌های حساب
func (h *BankHandler) Transactions(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var transactions []models.Transaction
	h.db.Where("bank_account_id = ?", id).
		Order("date desc").Limit(100).Find(&transactions)
	return c.JSON(transactions)
}
