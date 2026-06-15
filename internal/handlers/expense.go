package handlers

import (
	"strconv"
	"time"

	"vpn-accounting/internal/models"
	"vpn-accounting/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ExpenseHandler struct {
	db         *gorm.DB
	accounting *services.AccountingService
}

func NewExpenseHandler(db *gorm.DB, acc *services.AccountingService) *ExpenseHandler {
	return &ExpenseHandler{db: db, accounting: acc}
}

func (h *ExpenseHandler) List(c *fiber.Ctx) error {
	var expenses []models.Expense
	query := h.db.Preload("Category").Preload("BankAccount").Order("date desc")

	if catID := c.Query("category_id"); catID != "" {
		query = query.Where("category_id = ?", catID)
	}
	if from := c.Query("from"); from != "" {
		query = query.Where("date >= ?", from)
	}
	if to := c.Query("to"); to != "" {
		query = query.Where("date <= ?", to)
	}
	if paid := c.Query("is_paid"); paid != "" {
		query = query.Where("is_paid = ?", paid == "true")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.Expense{}).Count(&total)
	query.Offset(offset).Limit(limit).Find(&expenses)

	return c.JSON(fiber.Map{
		"data":  expenses,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *ExpenseHandler) Create(c *fiber.Ctx) error {
	var expense models.Expense
	if err := c.BodyParser(&expense); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}
	if expense.Date.IsZero() {
		expense.Date = time.Now()
	}

	if err := h.accounting.RecordExpense(&expense); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	h.db.Preload("Category").Preload("BankAccount").First(&expense, expense.ID)
	return c.Status(201).JSON(expense)
}

func (h *ExpenseHandler) Update(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var existing models.Expense
	if err := h.db.First(&existing, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "هزینه یافت نشد"})
	}

	var input models.Expense
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}

	if existing.BankAccountID != nil {
		h.db.Model(&models.BankAccount{}).Where("id = ?", *existing.BankAccountID).
			Update("balance", gorm.Expr("balance + ?", existing.Amount))
	}

	h.db.Model(&existing).Updates(input)

	if existing.BankAccountID != nil {
		h.db.Model(&models.BankAccount{}).Where("id = ?", *existing.BankAccountID).
			Update("balance", gorm.Expr("balance - ?", existing.Amount))
	}

	h.db.Preload("Category").Preload("BankAccount").First(&existing, id)
	return c.JSON(existing)
}

func (h *ExpenseHandler) Delete(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var expense models.Expense
	if err := h.db.First(&expense, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "هزینه یافت نشد"})
	}

	if expense.BankAccountID != nil {
		h.db.Model(&models.BankAccount{}).Where("id = ?", *expense.BankAccountID).
			Update("balance", gorm.Expr("balance + ?", expense.Amount))
	}

	h.db.Delete(&expense)
	return c.JSON(fiber.Map{"message": "حذف شد"})
}

// ListCategories — لیست دسته‌بندی‌ها
func (h *ExpenseHandler) ListCategories(c *fiber.Ctx) error {
	var categories []models.ExpenseCategory
	h.db.Order("is_system desc, name asc").Find(&categories)
	return c.JSON(categories)
}

// CreateCategory — ساخت دسته‌بندی جدید
func (h *ExpenseHandler) CreateCategory(c *fiber.Ctx) error {
	var cat models.ExpenseCategory
	if err := c.BodyParser(&cat); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "داده‌های نامعتبر"})
	}
	cat.Type = "custom"
	h.db.Create(&cat)
	return c.Status(201).JSON(cat)
}
