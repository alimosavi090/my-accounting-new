package handlers

import (
	"time"

	"vpn-accounting/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// JWTSecret کلید مخفی (در محیط پروداکشن باید در متغیر محلی باشد)
var JWTSecret = []byte("my_vpn_super_secret_key_12345")

type AuthHandler struct {
	db *gorm.DB
}

func NewAuthHandler(db *gorm.DB) *AuthHandler {
	return &AuthHandler{db: db}
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var input LoginRequest
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "اطلاعات نامعتبر"})
	}

	var user models.User
	if err := h.db.Where("username = ?", input.Username).First(&user).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "نام کاربری یا رمز عبور اشتباه است"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "نام کاربری یا رمز عبور اشتباه است"})
	}

	// ایجاد توکن JWT
	claims := jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"role":     user.Role,
		"exp":      time.Now().Add(time.Hour * 72).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, err := token.SignedString(JWTSecret)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "خطای داخلی سرور در صدور توکن"})
	}

	// بروزرسانی زمان آخرین ورود
	now := time.Now()
	h.db.Model(&user).Update("last_login", &now)

	return c.JSON(fiber.Map{
		"token": t,
		"user": fiber.Map{
			"username": user.Username,
			"role":     user.Role,
		},
	})
}
