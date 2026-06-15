package seed

import (
	"fmt"
	"log"
	"math/rand"
	"time"

	"vpn-accounting/internal/models"

	"gorm.io/gorm"
)

var persianNames = []string{
	"علی محمدی", "محمد حسینی", "رضا کریمی", "فاطمه احمدی", "زهرا موسوی",
	"امیر رضایی", "حسین علوی", "مریم نوری", "سارا جعفری", "احمد صادقی",
	"مهدی عباسی", "نرگس رحیمی", "پوریا نجفی", "الهام توکلی", "سعید خسروی",
}

var bankNames = []string{"ملت", "صادرات", "ملی", "پاسارگاد", "سامان"}
var bankColors = []string{"#ef476f", "#4361ee", "#06d6a0", "#ffd166", "#7b2ff7"}

var serverProviders = []string{"Hetzner", "OVH", "DigitalOcean", "Linode", "Vultr"}
var iranProviders = []string{"ابرآروان", "افرانت", "آسیاتک", "شاتل", "پارس‌آنلاین"}

func SeedDatabase(db *gorm.DB) {
	var count int64
	db.Model(&models.BankAccount{}).Count(&count)
	if count > 0 {
		log.Println("⏭️  دیتابیس قبلاً پر شده، از Seed رد می‌شود")
		return
	}

	log.Println("🌱 شروع Seed دیتابیس...")
	now := time.Now()
	r := rand.New(rand.NewSource(time.Now().UnixNano()))

	// ── حساب‌های بانکی ──
	banks := []models.BankAccount{
		{Title: "حساب اصلی ملت", BankName: bankNames[0], CardNumber: "6104-3378-1234-5678", AccountNumber: "1234567890", Balance: 85000000, Status: "active", Color: bankColors[0]},
		{Title: "حساب صادرات فروش", BankName: bankNames[1], CardNumber: "6037-6918-9876-5432", AccountNumber: "9876543210", Balance: 42000000, Status: "active", Color: bankColors[1]},
		{Title: "حساب ملی سرور", BankName: bankNames[2], CardNumber: "6037-9971-5555-4444", AccountNumber: "5554443210", Balance: 18500000, Status: "active", Color: bankColors[2]},
		{Title: "حساب پاسارگاد", BankName: bankNames[3], CardNumber: "5022-2910-3333-2222", AccountNumber: "3332221100", Balance: 63000000, Status: "active", Color: bankColors[3]},
		{Title: "حساب سامان پشتیبان", BankName: bankNames[4], CardNumber: "6219-8610-7777-8888", AccountNumber: "7778889900", Balance: 7200000, Status: "active", Color: bankColors[4]},
	}
	db.Create(&banks)

	// ── دسته‌بندی هزینه‌ها ──
	categories := []models.ExpenseCategory{
		{Name: "سرور ایران", Type: "iranian_server", Icon: "🖥️", Color: "#4361ee", IsSystem: true},
		{Name: "پهنای باند ایران", Type: "iranian_bandwidth", Icon: "📡", Color: "#06d6a0", IsSystem: true},
		{Name: "سرور خارج", Type: "foreign_server", Icon: "🌍", Color: "#7b2ff7", IsSystem: true},
		{Name: "ArvanCloud CDN", Type: "arvancloud", Icon: "☁️", Color: "#ff6b35", IsSystem: true},
		{Name: "تبلیغات", Type: "custom", Icon: "📢", Color: "#ffd166", IsSystem: false},
		{Name: "حقوق و دستمزد", Type: "custom", Icon: "💰", Color: "#ef476f", IsSystem: false},
		{Name: "متفرقه", Type: "custom", Icon: "📦", Color: "#4cc9f0", IsSystem: false},
	}
	db.Create(&categories)

	// ── نمایندگان ──
	resellers := make([]models.Reseller, len(persianNames))
	for i, name := range persianNames {
		resellers[i] = models.Reseller{
			FullName:         name,
			Mobile:           fmt.Sprintf("09%d", 100000000+r.Intn(899999999)),
			TelegramID:       fmt.Sprintf("@%s_%d", "reseller", i+1),
			Status:           "active",
			RegistrationDate: now.AddDate(0, -r.Intn(6)-1, -r.Intn(28)),
		}
	}
	db.Create(&resellers)

	// ── داده‌های 90 روز گذشته ──
	txCounter := 1000

	for day := 90; day >= 0; day-- {
		date := now.AddDate(0, 0, -day)
		date = time.Date(date.Year(), date.Month(), date.Day(), r.Intn(18)+6, r.Intn(60), 0, 0, now.Location())

		// درآمدها (2-5 عدد در روز)
		revenueCount := r.Intn(4) + 2
		for j := 0; j < revenueCount; j++ {
			sources := []string{"zarinpal", "card_to_card", "manual"}
			source := sources[r.Intn(len(sources))]
			bankID := banks[r.Intn(len(banks))].ID
			amount := int64((r.Intn(50)+5) * 100000) // 500K - 5.5M

			rev := models.Revenue{
				Source:        source,
				Amount:        amount,
				BankAccountID: &bankID,
				Date:          date.Add(time.Duration(j) * time.Hour),
				Notes:         fmt.Sprintf("درآمد %s - روز %d", source, day),
			}
			if source == "zarinpal" {
				rev.TransactionRef = fmt.Sprintf("ZP-%d%d", date.Unix(), j)
			}
			if source == "card_to_card" {
				rev.SourceCard = fmt.Sprintf("6104-****-****-%04d", r.Intn(10000))
			}
			db.Create(&rev)

			// تراکنش
			txCounter++
			tx := models.Transaction{
				TxNumber:      fmt.Sprintf("TX-%07d", txCounter),
				Type:          "revenue",
				Amount:        amount,
				Date:          rev.Date,
				BankAccountID: &bankID,
				Description:   fmt.Sprintf("درآمد %s", source),
				Creator:       "system",
			}
			db.Create(&tx)
		}

		// هزینه‌ها (0-3 عدد در روز)
		expenseCount := r.Intn(4)
		for j := 0; j < expenseCount; j++ {
			catIdx := r.Intn(len(categories))
			catID := categories[catIdx].ID
			bankID := banks[r.Intn(len(banks))].ID
			amount := int64((r.Intn(30)+2) * 100000) // 200K - 3.2M

			exp := models.Expense{
				Title:         fmt.Sprintf("هزینه %s #%d", categories[catIdx].Name, day),
				CategoryID:    &catID,
				Provider:      iranProviders[r.Intn(len(iranProviders))],
				Amount:        amount,
				BankAccountID: &bankID,
				Date:          date.Add(time.Duration(j+revenueCount) * time.Hour),
				IsPaid:        r.Float64() > 0.1, // 90% paid
				Notes:         fmt.Sprintf("هزینه روز %d", day),
			}

			// تاریخ تمدید برای سرورها
			if catIdx < 3 {
				renewal := date.AddDate(0, 1, 0)
				exp.RenewalDate = &renewal
			}

			db.Create(&exp)

			txCounter++
			tx := models.Transaction{
				TxNumber:      fmt.Sprintf("TX-%07d", txCounter),
				Type:          "expense",
				Amount:        amount,
				Date:          exp.Date,
				BankAccountID: &bankID,
				Description:   fmt.Sprintf("هزینه - %s", exp.Title),
				Creator:       "system",
			}
			db.Create(&tx)
		}

		// فروش نمایندگان (1-3 عدد در روز)
		saleCount := r.Intn(3) + 1
		for j := 0; j < saleCount; j++ {
			resellerIdx := r.Intn(len(resellers))
			resellerID := resellers[resellerIdx].ID
			amount := int64((r.Intn(20)+3) * 100000) // 300K - 2.3M

			// دفتر کل
			var lastLedger models.ResellerLedger
			db.Where("reseller_id = ?", resellerID).Order("id desc").First(&lastLedger)

			ledger := models.ResellerLedger{
				ResellerID:     resellerID,
				Type:           "sale",
				Amount:         amount,
				RunningBalance: lastLedger.RunningBalance + amount,
				Description:    fmt.Sprintf("فروش VPN - %s", persianNames[resellerIdx]),
				Date:           date.Add(time.Duration(j+5) * time.Hour),
			}
			db.Create(&ledger)

			txCounter++
			tx := models.Transaction{
				TxNumber:   fmt.Sprintf("TX-%07d", txCounter),
				Type:       "revenue",
				Amount:     amount,
				Date:       ledger.Date,
				ResellerID: &resellerID,
				Description: fmt.Sprintf("فروش نماینده %s", persianNames[resellerIdx]),
				Creator:    "system",
			}
			db.Create(&tx)
		}

		// تسویه‌حساب (هر 3-5 روز)
		if day%4 == 0 {
			for _, reseller := range resellers {
				if r.Float64() > 0.3 {
					continue
				}

				var lastLedger models.ResellerLedger
				db.Where("reseller_id = ?", reseller.ID).Order("id desc").First(&lastLedger)

				if lastLedger.RunningBalance <= 0 {
					continue
				}

				settleAmount := lastLedger.RunningBalance * int64(r.Intn(80)+20) / 100
				bankID := banks[r.Intn(len(banks))].ID

				settlement := models.Settlement{
					ResellerID:    reseller.ID,
					Amount:        settleAmount,
					BankAccountID: &bankID,
					Date:          date.Add(time.Duration(10+r.Intn(8)) * time.Hour),
					Notes:         "تسویه حساب دوره‌ای",
				}
				db.Create(&settlement)

				newBalance := lastLedger.RunningBalance - settleAmount
				ledger := models.ResellerLedger{
					ResellerID:     reseller.ID,
					Type:           "settlement",
					Amount:         settleAmount,
					RunningBalance: newBalance,
					Description:    "تسویه حساب",
					Date:           settlement.Date,
				}
				db.Create(&ledger)

				txCounter++
				tx := models.Transaction{
					TxNumber:      fmt.Sprintf("TX-%07d", txCounter),
					Type:          "settlement",
					Amount:        settleAmount,
					Date:          settlement.Date,
					BankAccountID: &bankID,
					ResellerID:    &reseller.ID,
					Description:   fmt.Sprintf("تسویه حساب %s", reseller.FullName),
					Creator:       "system",
				}
				db.Create(&tx)
			}
		}
	}

	log.Println("✅ Seed دیتابیس با موفقیت انجام شد (90 روز داده)")
}
