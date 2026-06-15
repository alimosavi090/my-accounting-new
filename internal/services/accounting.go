package services

import (
	"fmt"
	"time"

	"vpn-accounting/internal/models"

	"gorm.io/gorm"
)

type AccountingService struct {
	db *gorm.DB
}

func NewAccountingService(db *gorm.DB) *AccountingService {
	return &AccountingService{db: db}
}

// GenerateTxNumber — تولید شماره تراکنش یکتا
func (s *AccountingService) GenerateTxNumber() string {
	return fmt.Sprintf("TX-%d", time.Now().UnixNano()/1000000)
}

// RecordRevenue — ثبت درآمد با ورودی‌های حسابداری
func (s *AccountingService) RecordRevenue(revenue *models.Revenue) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// ذخیره درآمد
		if err := tx.Create(revenue).Error; err != nil {
			return err
		}

		// ساخت تراکنش
		txn := models.Transaction{
			TxNumber:      s.GenerateTxNumber(),
			Type:          "revenue",
			Amount:        revenue.Amount,
			Date:          revenue.Date,
			BankAccountID: revenue.BankAccountID,
			Description:   fmt.Sprintf("درآمد %s - %s", revenue.Source, revenue.Notes),
			Creator:       "system",
		}
		if err := tx.Create(&txn).Error; err != nil {
			return err
		}

		// ثبت‌های حسابداری دوبل
		entries := []models.AccountingEntry{
			{
				TransactionID: txn.ID,
				AccountType:   "bank",
				AccountID:     safeUint(revenue.BankAccountID),
				DebitAmount:   revenue.Amount,
				CreditAmount:  0,
				Description:   "افزایش موجودی بانک - درآمد",
				Date:          revenue.Date,
			},
			{
				TransactionID: txn.ID,
				AccountType:   "revenue",
				AccountID:     revenue.ID,
				DebitAmount:   0,
				CreditAmount:  revenue.Amount,
				Description:   "شناسایی درآمد",
				Date:          revenue.Date,
			},
		}
		for _, entry := range entries {
			if err := tx.Create(&entry).Error; err != nil {
				return err
			}
		}

		// بروزرسانی موجودی بانک
		if revenue.BankAccountID != nil {
			if err := tx.Model(&models.BankAccount{}).Where("id = ?", *revenue.BankAccountID).
				Update("balance", gorm.Expr("balance + ?", revenue.Amount)).Error; err != nil {
				return err
			}
		}

		// ثبت لاگ
		return s.createAuditLog(tx, "revenue", revenue.ID, "create", "", fmt.Sprintf("%+v", revenue))
	})
}

// RecordExpense — ثبت هزینه
func (s *AccountingService) RecordExpense(expense *models.Expense) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(expense).Error; err != nil {
			return err
		}

		txn := models.Transaction{
			TxNumber:      s.GenerateTxNumber(),
			Type:          "expense",
			Amount:        expense.Amount,
			Date:          expense.Date,
			BankAccountID: expense.BankAccountID,
			Description:   fmt.Sprintf("هزینه - %s - %s", expense.Title, expense.Notes),
			Creator:       "system",
		}
		if err := tx.Create(&txn).Error; err != nil {
			return err
		}

		entries := []models.AccountingEntry{
			{
				TransactionID: txn.ID,
				AccountType:   "expense",
				AccountID:     expense.ID,
				DebitAmount:   expense.Amount,
				CreditAmount:  0,
				Description:   "شناسایی هزینه",
				Date:          expense.Date,
			},
			{
				TransactionID: txn.ID,
				AccountType:   "bank",
				AccountID:     safeUint(expense.BankAccountID),
				DebitAmount:   0,
				CreditAmount:  expense.Amount,
				Description:   "کاهش موجودی بانک - هزینه",
				Date:          expense.Date,
			},
		}
		for _, entry := range entries {
			if err := tx.Create(&entry).Error; err != nil {
				return err
			}
		}

		if expense.BankAccountID != nil {
			if err := tx.Model(&models.BankAccount{}).Where("id = ?", *expense.BankAccountID).
				Update("balance", gorm.Expr("balance - ?", expense.Amount)).Error; err != nil {
				return err
			}
		}

		return s.createAuditLog(tx, "expense", expense.ID, "create", "", fmt.Sprintf("%+v", expense))
	})
}

// RecordBankTransfer — انتقال بین حساب‌ها
func (s *AccountingService) RecordBankTransfer(sourceID, destID uint, amount int64, date time.Time, notes string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		txn := models.Transaction{
			TxNumber:      s.GenerateTxNumber(),
			Type:          "transfer",
			Amount:        amount,
			Date:          date,
			BankAccountID: &sourceID,
			Description:   fmt.Sprintf("انتقال بین حسابی - %s", notes),
			Creator:       "system",
		}
		if err := tx.Create(&txn).Error; err != nil {
			return err
		}

		entries := []models.AccountingEntry{
			{
				TransactionID: txn.ID,
				AccountType:   "bank",
				AccountID:     destID,
				DebitAmount:   amount,
				CreditAmount:  0,
				Description:   "افزایش موجودی - انتقال دریافتی",
				Date:          date,
			},
			{
				TransactionID: txn.ID,
				AccountType:   "bank",
				AccountID:     sourceID,
				DebitAmount:   0,
				CreditAmount:  amount,
				Description:   "کاهش موجودی - انتقال ارسالی",
				Date:          date,
			},
		}
		for _, entry := range entries {
			if err := tx.Create(&entry).Error; err != nil {
				return err
			}
		}

		// کاهش مبدا
		if err := tx.Model(&models.BankAccount{}).Where("id = ?", sourceID).
			Update("balance", gorm.Expr("balance - ?", amount)).Error; err != nil {
			return err
		}

		// افزایش مقصد
		if err := tx.Model(&models.BankAccount{}).Where("id = ?", destID).
			Update("balance", gorm.Expr("balance + ?", amount)).Error; err != nil {
			return err
		}

		return s.createAuditLog(tx, "transfer", txn.ID, "create", "",
			fmt.Sprintf("source=%d, dest=%d, amount=%d", sourceID, destID, amount))
	})
}

// RecordSettlement — تسویه حساب نماینده
func (s *AccountingService) RecordSettlement(settlement *models.Settlement) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(settlement).Error; err != nil {
			return err
		}

		txn := models.Transaction{
			TxNumber:      s.GenerateTxNumber(),
			Type:          "settlement",
			Amount:        settlement.Amount,
			Date:          settlement.Date,
			BankAccountID: settlement.BankAccountID,
			ResellerID:    &settlement.ResellerID,
			Description:   fmt.Sprintf("تسویه حساب نماینده - %s", settlement.Notes),
			Creator:       "system",
		}
		if err := tx.Create(&txn).Error; err != nil {
			return err
		}

		entries := []models.AccountingEntry{
			{
				TransactionID: txn.ID,
				AccountType:   "bank",
				AccountID:     safeUint(settlement.BankAccountID),
				DebitAmount:   0,
				CreditAmount:  settlement.Amount,
				Description:   "کاهش موجودی بانک - تسویه",
				Date:          settlement.Date,
			},
			{
				TransactionID: txn.ID,
				AccountType:   "reseller",
				AccountID:     settlement.ResellerID,
				DebitAmount:   settlement.Amount,
				CreditAmount:  0,
				Description:   "کاهش بدهی نماینده - تسویه",
				Date:          settlement.Date,
			},
		}
		for _, entry := range entries {
			if err := tx.Create(&entry).Error; err != nil {
				return err
			}
		}

		// کاهش موجودی بانک
		if settlement.BankAccountID != nil {
			if err := tx.Model(&models.BankAccount{}).Where("id = ?", *settlement.BankAccountID).
				Update("balance", gorm.Expr("balance - ?", settlement.Amount)).Error; err != nil {
				return err
			}
		}

		// ثبت در دفتر کل نماینده
		var lastLedger models.ResellerLedger
		tx.Where("reseller_id = ?", settlement.ResellerID).Order("id desc").First(&lastLedger)
		newBalance := lastLedger.RunningBalance - settlement.Amount

		ledger := models.ResellerLedger{
			ResellerID:     settlement.ResellerID,
			Type:           "settlement",
			Amount:         settlement.Amount,
			RunningBalance: newBalance,
			Description:    fmt.Sprintf("تسویه حساب - %s", settlement.Notes),
			Date:           settlement.Date,
		}
		if err := tx.Create(&ledger).Error; err != nil {
			return err
		}

		return s.createAuditLog(tx, "settlement", settlement.ID, "create", "", fmt.Sprintf("%+v", settlement))
	})
}

// RecordResellerSale — ثبت فروش نماینده
func (s *AccountingService) RecordResellerSale(resellerID uint, amount int64, date time.Time, description string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		txn := models.Transaction{
			TxNumber:   s.GenerateTxNumber(),
			Type:       "revenue",
			Amount:     amount,
			Date:       date,
			ResellerID: &resellerID,
			Description: description,
			Creator:    "system",
		}
		if err := tx.Create(&txn).Error; err != nil {
			return err
		}

		entries := []models.AccountingEntry{
			{
				TransactionID: txn.ID,
				AccountType:   "reseller",
				AccountID:     resellerID,
				DebitAmount:   amount,
				CreditAmount:  0,
				Description:   "افزایش بدهی نماینده - فروش",
				Date:          date,
			},
			{
				TransactionID: txn.ID,
				AccountType:   "revenue",
				AccountID:     0,
				DebitAmount:   0,
				CreditAmount:  amount,
				Description:   "شناسایی درآمد فروش نماینده",
				Date:          date,
			},
		}
		for _, entry := range entries {
			if err := tx.Create(&entry).Error; err != nil {
				return err
			}
		}

		// ثبت در دفتر کل
		var lastLedger models.ResellerLedger
		tx.Where("reseller_id = ?", resellerID).Order("id desc").First(&lastLedger)
		newBalance := lastLedger.RunningBalance + amount

		ledger := models.ResellerLedger{
			ResellerID:     resellerID,
			Type:           "sale",
			Amount:         amount,
			RunningBalance: newBalance,
			Description:    description,
			Date:           date,
		}
		if err := tx.Create(&ledger).Error; err != nil {
			return err
		}

		return nil
	})
}

// RecordBankDeposit — واریز به حساب
func (s *AccountingService) RecordBankDeposit(bankID uint, amount int64, date time.Time, notes string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		txn := models.Transaction{
			TxNumber:      s.GenerateTxNumber(),
			Type:          "adjustment",
			Amount:        amount,
			Date:          date,
			BankAccountID: &bankID,
			Description:   fmt.Sprintf("واریز به حساب - %s", notes),
			Creator:       "system",
		}
		if err := tx.Create(&txn).Error; err != nil {
			return err
		}

		entry := models.AccountingEntry{
			TransactionID: txn.ID,
			AccountType:   "bank",
			AccountID:     bankID,
			DebitAmount:   amount,
			CreditAmount:  0,
			Description:   "واریز به حساب",
			Date:          date,
		}
		if err := tx.Create(&entry).Error; err != nil {
			return err
		}

		return tx.Model(&models.BankAccount{}).Where("id = ?", bankID).
			Update("balance", gorm.Expr("balance + ?", amount)).Error
	})
}

// RecordBankWithdrawal — برداشت از حساب
func (s *AccountingService) RecordBankWithdrawal(bankID uint, amount int64, date time.Time, notes string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		txn := models.Transaction{
			TxNumber:      s.GenerateTxNumber(),
			Type:          "adjustment",
			Amount:        amount,
			Date:          date,
			BankAccountID: &bankID,
			Description:   fmt.Sprintf("برداشت از حساب - %s", notes),
			Creator:       "system",
		}
		if err := tx.Create(&txn).Error; err != nil {
			return err
		}

		entry := models.AccountingEntry{
			TransactionID: txn.ID,
			AccountType:   "bank",
			AccountID:     bankID,
			DebitAmount:   0,
			CreditAmount:  amount,
			Description:   "برداشت از حساب",
			Date:          date,
		}
		if err := tx.Create(&entry).Error; err != nil {
			return err
		}

		return tx.Model(&models.BankAccount{}).Where("id = ?", bankID).
			Update("balance", gorm.Expr("balance - ?", amount)).Error
	})
}

// RecordResellerAdjustment — تعدیل بدهی/اعتبار نماینده
func (s *AccountingService) RecordResellerAdjustment(resellerID uint, amount int64, adjustType string, date time.Time, description string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		txn := models.Transaction{
			TxNumber:    s.GenerateTxNumber(),
			Type:        "adjustment",
			Amount:      amount,
			Date:        date,
			ResellerID:  &resellerID,
			Description: description,
			Creator:     "system",
		}
		if err := tx.Create(&txn).Error; err != nil {
			return err
		}

		var lastLedger models.ResellerLedger
		tx.Where("reseller_id = ?", resellerID).Order("id desc").First(&lastLedger)

		var newBalance int64
		if adjustType == "debit_adjust" {
			newBalance = lastLedger.RunningBalance + amount
		} else {
			newBalance = lastLedger.RunningBalance - amount
		}

		ledger := models.ResellerLedger{
			ResellerID:     resellerID,
			Type:           adjustType,
			Amount:         amount,
			RunningBalance: newBalance,
			Description:    description,
			Date:           date,
		}
		return tx.Create(&ledger).Error
	})
}

// createAuditLog — ثبت لاگ تغییرات
func (s *AccountingService) createAuditLog(tx *gorm.DB, entityType string, entityID uint, action, prevVal, newVal string) error {
	log := models.AuditLog{
		EntityType:    entityType,
		EntityID:      entityID,
		Action:        action,
		User:          "admin",
		PreviousValue: prevVal,
		NewValue:      newVal,
	}
	return tx.Create(&log).Error
}

func safeUint(v *uint) uint {
	if v != nil {
		return *v
	}
	return 0
}
