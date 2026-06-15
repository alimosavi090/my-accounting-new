package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"vpn-accounting/internal/database"
	"vpn-accounting/internal/handlers"
	"vpn-accounting/internal/middleware"
	"vpn-accounting/internal/seed"
	"vpn-accounting/internal/services"
)

func main() {
	log.Println("🚀 شروع سیستم حسابداری VPN...")

	// اتصال دیتابیس
	database.Initialize()

	// Seed دیتابیس
	seed.SeedDatabase(database.DB)

	// ساخت Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "VPN Accounting Platform",
		BodyLimit:    10 * 1024 * 1024,
		ServerHeader: "VPN-Accounting",
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format:     "${time} | ${status} | ${latency} | ${method} ${path}\n",
		TimeFormat: "15:04:05",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Content-Type,Authorization",
	}))

	// Static files
	app.Static("/", "./web/static", fiber.Static{
		Index:    "index.html",
		Compress: true,
	})

	// Public API Routes
	auth := handlers.NewAuthHandler(database.DB)
	app.Post("/api/v1/auth/login", auth.Login)

	// Protected API Routes
	api := app.Group("/api/v1", middleware.Protected())
	setupRoutes(api)

	// پورت
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// Graceful shutdown
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		log.Println("🛑 در حال خاموش شدن...")
		app.Shutdown()
	}()

	log.Printf("✅ سرور در حال اجرا روی http://localhost:%s\n", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("خطا در اجرای سرور: %v", err)
	}
}

func setupRoutes(api fiber.Router) {
	db := database.DB
	acc := services.NewAccountingService(db)

	dash := handlers.NewDashboardHandler(db)
	rev := handlers.NewRevenueHandler(db, acc)
	exp := handlers.NewExpenseHandler(db, acc)
	bank := handlers.NewBankHandler(db, acc)
	reseller := handlers.NewResellerHandler(db, acc)
	settlement := handlers.NewSettlementHandler(db, acc)
	tx := handlers.NewTransactionHandler(db)
	report := handlers.NewReportHandler(db)
	search := handlers.NewSearchHandler(db)
	audit := handlers.NewAuditHandler(db)

	// Dashboard
	dashboard := api.Group("/dashboard")
	dashboard.Get("/summary", dash.Summary)
	dashboard.Get("/reseller-status", dash.ResellerStatus)
	dashboard.Get("/bank-overview", dash.BankOverview)
	dashboard.Get("/charts", dash.Charts)
	dashboard.Get("/top-resellers", dash.TopResellers)
	dashboard.Get("/recent-activity", dash.RecentActivity)
	dashboard.Get("/alerts", dash.Alerts)

	// Revenue
	api.Get("/revenues", rev.List)
	api.Post("/revenues", rev.Create)
	api.Put("/revenues/:id", rev.Update)
	api.Delete("/revenues/:id", rev.Delete)

	// Expenses
	api.Get("/expenses", exp.List)
	api.Post("/expenses", exp.Create)
	api.Put("/expenses/:id", exp.Update)
	api.Delete("/expenses/:id", exp.Delete)
	api.Get("/expense-categories", exp.ListCategories)
	api.Post("/expense-categories", exp.CreateCategory)

	// Banks
	api.Get("/banks", bank.List)
	api.Get("/banks/:id", bank.Get)
	api.Post("/banks", bank.Create)
	api.Put("/banks/:id", bank.Update)
	api.Delete("/banks/:id", bank.Delete)
	api.Post("/banks/deposit", bank.Deposit)
	api.Post("/banks/withdraw", bank.Withdraw)
	api.Post("/banks/transfer", bank.Transfer)
	api.Get("/banks/:id/transactions", bank.Transactions)

	// Resellers
	api.Get("/resellers", reseller.List)
	api.Get("/resellers/:id", reseller.Get)
	api.Post("/resellers", reseller.Create)
	api.Put("/resellers/:id", reseller.Update)
	api.Delete("/resellers/:id", reseller.Delete)
	api.Get("/resellers/:id/ledger", reseller.Ledger)
	api.Post("/resellers/:id/sale", reseller.RecordSale)
	api.Post("/resellers/:id/adjust", reseller.Adjust)

	// Settlements
	api.Get("/settlements", settlement.List)
	api.Post("/settlements", settlement.Create)
	api.Get("/settlements/reseller/:id", settlement.ByReseller)

	// Transactions
	api.Get("/transactions", tx.List)
	api.Get("/transactions/:id", tx.Get)

	// Reports
	api.Get("/reports/daily", report.Daily)
	api.Get("/reports/weekly", report.Weekly)
	api.Get("/reports/monthly", report.Monthly)
	api.Get("/reports/profit-loss", report.ProfitLoss)
	api.Get("/reports/reseller/:id", report.ResellerReport)
	api.Get("/reports/bank/:id", report.BankReport)
	api.Get("/reports/expense-analysis", report.ExpenseAnalysis)

	// Search
	api.Get("/search", search.Search)

	// Audit
	api.Get("/audit-logs", audit.List)
}
