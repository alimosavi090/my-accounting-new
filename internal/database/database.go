package database

import (
	"log"
	"os"

	"vpn-accounting/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Initialize() {
	// اطمینان از وجود دایرکتوری data
	if err := os.MkdirAll("data", 0755); err != nil {
		log.Fatalf("خطا در ساخت دایرکتوری data: %v", err)
	}

	var err error
	DB, err = gorm.Open(sqlite.Open("data/vpn_accounting.db?_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL&_cache_size=1000000000&_foreign_keys=ON"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("خطا در اتصال به دیتابیس: %v", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("خطا در دریافت sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	log.Println("✅ اتصال به دیتابیس برقرار شد (WAL mode)")

	// Auto-migrate تمام مدل‌ها
	err = DB.AutoMigrate(
		&models.User{},
		&models.BankAccount{},
		&models.ExpenseCategory{},
		&models.Revenue{},
		&models.Expense{},
		&models.Reseller{},
		&models.ResellerLedger{},
		&models.Settlement{},
		&models.Transaction{},
		&models.AccountingEntry{},
		&models.ProfitLossSnapshot{},
		&models.AuditLog{},
		&models.Setting{},
	)
	if err != nil {
		log.Fatalf("خطا در migration: %v", err)
	}

	log.Println("✅ Migration با موفقیت انجام شد")
}
