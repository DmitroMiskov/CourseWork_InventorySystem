using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Inventory.Domain.Entities;
using Inventory.Domain.Enums;
using Inventory.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Inventory.API.Data
{
    public static class DbInitializer
    {
        public static async Task InitializeAsync(
            ApplicationDbContext context,
            UserManager<IdentityUser> userManager,
            RoleManager<IdentityRole> roleManager,
            IConfiguration configuration,
            ILogger logger)
        {
            try
            {
                // Забезпечуємо створення схеми БД, якщо вона відсутня
                await context.Database.EnsureCreatedAsync();

                // Гарантуємо наявність нових колонок у таблиці Suppliers для наявних баз
                try
                {
                    await context.Database.ExecuteSqlRawAsync(@"
                        ALTER TABLE ""Suppliers"" ADD COLUMN IF NOT EXISTS ""Edrpou"" text NOT NULL DEFAULT '';
                        ALTER TABLE ""Suppliers"" ADD COLUMN IF NOT EXISTS ""Address"" text NOT NULL DEFAULT '';
                        ALTER TABLE ""Suppliers"" ADD COLUMN IF NOT EXISTS ""LeadTimeDays"" integer NOT NULL DEFAULT 5;
                        ALTER TABLE ""Suppliers"" ADD COLUMN IF NOT EXISTS ""ContractNumber"" text NOT NULL DEFAULT '';
                        ALTER TABLE ""Suppliers"" ADD COLUMN IF NOT EXISTS ""PaymentTerms"" text NOT NULL DEFAULT '';
                    ");
                }
                catch
                {
                    // Ігноруємо для In-Memory або якщо база щойно створена
                }

                // 1. Створення стандартних ролей
                string[] roles = { "Admin", "Manager", "WarehouseWorker", "User" };
                foreach (var role in roles)
                {
                    if (!await roleManager.RoleExistsAsync(role))
                    {
                        await roleManager.CreateAsync(new IdentityRole(role));
                        logger.LogInformation("✅ Роль '{Role}' створено.", role);
                    }
                }

                // 2. Створення / перевірка типових облікових записів (Admin, Manager, WarehouseWorker)
                var superuserConfig = configuration.GetSection("Superuser");
                var adminUsername = superuserConfig["Username"] ?? "admin";
                var adminPassword = superuserConfig["Password"] ?? "Admin123!";
                var adminEmail = superuserConfig["Email"] ?? "admin@inventory.local";
                var adminRoleName = superuserConfig["Role"] ?? "Admin";
                var ensurePassword = configuration.GetValue<bool>("Superuser:EnsurePassword", true);

                await EnsureUserAsync(userManager, logger, adminUsername, adminPassword, adminEmail, adminRoleName, ensurePassword);
                await EnsureUserAsync(userManager, logger, "manager", "Manager123!", "manager@inventory.local", "Manager", ensurePassword);
                await EnsureUserAsync(userManager, logger, "worker", "Worker123!", "worker@inventory.local", "WarehouseWorker", ensurePassword);

                // 3. Автоматичний посів демо-даних складу (якщо база порожня)
                await SeedDemoWarehouseDataAsync(context, logger);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "❌ Помилка під час ініціалізації суперкористувача та БД");
            }
        }

        private static async Task EnsureUserAsync(
            UserManager<IdentityUser> userManager,
            ILogger logger,
            string username,
            string password,
            string email,
            string roleName,
            bool ensurePassword)
        {
            var user = await userManager.FindByNameAsync(username);
            if (user == null)
            {
                user = new IdentityUser
                {
                    UserName = username,
                    Email = email,
                    EmailConfirmed = true
                };

                var result = await userManager.CreateAsync(user, password);
                if (result.Succeeded)
                {
                    await userManager.AddToRoleAsync(user, roleName);
                    logger.LogInformation("✅ Користувача '{Username}' успішно створено з роллю '{Role}'.", username, roleName);
                }
                else
                {
                    var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                    logger.LogError("❌ Не вдалося створити користувача '{Username}': {Errors}", username, errors);
                }
            }
            else
            {
                // Якщо користувач вже існує - гарантуємо, що у нього є задана роль
                if (!await userManager.IsInRoleAsync(user, roleName))
                {
                    await userManager.AddToRoleAsync(user, roleName);
                    logger.LogInformation("✅ Роль '{Role}' призначено для користувача '{Username}'.", roleName, username);
                }

                // Якщо увімкнено ensurePassword та поточний пароль не підходить - скидаємо до дефолтного
                if (ensurePassword && !await userManager.CheckPasswordAsync(user, password))
                {
                    var resetToken = await userManager.GeneratePasswordResetTokenAsync(user);
                    var resetResult = await userManager.ResetPasswordAsync(user, resetToken, password);
                    if (resetResult.Succeeded)
                    {
                        logger.LogInformation("🔑 Пароль користувача '{Username}' оновлено до гарантованого дефолтного.", username);
                    }
                }

                // Зняття можливого блокування облікового запису
                if (await userManager.IsLockedOutAsync(user))
                {
                    await userManager.SetLockoutEndDateAsync(user, null);
                    logger.LogInformation("🔓 Блокування з облікового запису '{Username}' знято.", username);
                }
            }
        }

        private static async Task SeedDemoWarehouseDataAsync(ApplicationDbContext context, ILogger logger)
        {
            if (await context.Products.AnyAsync())
            {
                return;
            }

            logger.LogInformation("📦 База даних порожня. Запуск автоматичного наповнення демонстраційними даними складу...");

            var nowUtc = DateTime.UtcNow;

            // 1. Категорії
            var categories = new Dictionary<string, Category>();
            string[] categoryNames = {
                "Ноутбуки",
                "Смартфони",
                "Монітори",
                "Периферія",
                "Комплектуючі",
                "Мережеве обладнання",
                "Офісна техніка"
            };

            foreach (var catName in categoryNames)
            {
                var existingCat = await context.Categories.FirstOrDefaultAsync(c => c.Name == catName);
                if (existingCat == null)
                {
                    existingCat = new Category { Id = Guid.NewGuid(), Name = catName };
                    await context.Categories.AddAsync(existingCat);
                }
                categories[catName] = existingCat;
            }
            await context.SaveChangesAsync();

            // 2. Постачальники
            var suppliers = new Dictionary<string, Supplier>();
            var supplierDefs = new[]
            {
                new { 
                    Key = "techno", 
                    Name = "ТОВ \"ТехноДистриб'юшн\"", 
                    Contact = "Мельник Олександр", 
                    Phone = "+380442301122", 
                    Email = "sales@technodistr.ua",
                    Edrpou = "38492011",
                    Address = "м. Київ, вул. Велика Васильківська, 72",
                    LeadTime = 5,
                    Contract = "Договір № ТД-2025/03 від 14.03.2025",
                    Terms = "Відтермінування платежу 14 днів"
                },
                new { 
                    Key = "areo", 
                    Name = "ТОВ \"АРЕО\"", 
                    Contact = "Ковальчук Ірина", 
                    Phone = "+380443912040", 
                    Email = "info@areo.com.ua",
                    Edrpou = "40192833",
                    Address = "м. Київ, просп. Степана Бандери, 21",
                    LeadTime = 3,
                    Contract = "Договір № АР-88 від 10.01.2025",
                    Terms = "Оплата по факту поставки (3 дні)"
                },
                new { 
                    Key = "itlog", 
                    Name = "ТОВ \"ІТ-Логістик Україна\"", 
                    Contact = "Шевченко Дмитро", 
                    Phone = "+380504123344", 
                    Email = "order@it-logistic.ua",
                    Edrpou = "39821455",
                    Address = "м. Львів, вул. Городоцька, 174",
                    LeadTime = 4,
                    Contract = "Договір № ІТЛ-19/24 від 01.11.2024",
                    Terms = "100% попередня оплата"
                },
                new { 
                    Key = "net", 
                    Name = "ПП \"Мережеві Рішення\"", 
                    Contact = "Бондаренко Андрій", 
                    Phone = "+380675001234", 
                    Email = "net@solutions.ua",
                    Edrpou = "37554812",
                    Address = "м. Дніпро, вул. Січових Стрільців, 4-А",
                    LeadTime = 6,
                    Contract = "Договір № МР-42/25 від 20.02.2025",
                    Terms = "Відтермінування платежу 7 днів"
                }
            };

            foreach (var sDef in supplierDefs)
            {
                var existingSupplier = await context.Suppliers.FirstOrDefaultAsync(s => s.Name == sDef.Name);
                if (existingSupplier == null)
                {
                    existingSupplier = new Supplier
                    {
                        Id = Guid.NewGuid(),
                        Name = sDef.Name,
                        ContactPerson = sDef.Contact,
                        Phone = sDef.Phone,
                        Email = sDef.Email,
                        Edrpou = sDef.Edrpou,
                        Address = sDef.Address,
                        LeadTimeDays = sDef.LeadTime,
                        ContractNumber = sDef.Contract,
                        PaymentTerms = sDef.Terms,
                        Created = nowUtc.AddMonths(-3),
                        CreatedBy = "SystemSeed"
                    };
                    await context.Suppliers.AddAsync(existingSupplier);
                }
                else
                {
                    if (string.IsNullOrEmpty(existingSupplier.Edrpou)) existingSupplier.Edrpou = sDef.Edrpou;
                    if (string.IsNullOrEmpty(existingSupplier.Address)) existingSupplier.Address = sDef.Address;
                    if (string.IsNullOrEmpty(existingSupplier.ContractNumber)) existingSupplier.ContractNumber = sDef.Contract;
                    if (string.IsNullOrEmpty(existingSupplier.PaymentTerms)) existingSupplier.PaymentTerms = sDef.Terms;
                    if (existingSupplier.LeadTimeDays <= 0) existingSupplier.LeadTimeDays = sDef.LeadTime;
                }
                suppliers[sDef.Key] = existingSupplier;
            }
            await context.SaveChangesAsync();

            // 3. Клієнти (Покупці)
            var customers = new List<Customer>();
            var customerDefs = new[]
            {
                new { Name = "ТОВ \"Східний Логістичний Центр\"", Phone = "+380501112233", Email = "logistics@east-center.com.ua", Address = "м. Київ, вул. Промислова, 14" },
                new { Name = "ТОВ \"Креатив Софт\"", Phone = "+380679998877", Email = "buy@creativesoft.ua", Address = "м. Львів, вул. Наукова, 7-Б" },
                new { Name = "ПрАТ \"ПромТехСервіс\"", Phone = "+380445554433", Email = "supply@promtech.ua", Address = "м. Дніпро, пр. Богдана Хмельницького, 42" }
            };

            foreach (var cDef in customerDefs)
            {
                var existingCust = await context.Customers.FirstOrDefaultAsync(c => c.Name == cDef.Name);
                if (existingCust == null)
                {
                    existingCust = new Customer
                    {
                        Id = Guid.NewGuid(),
                        Name = cDef.Name,
                        Phone = cDef.Phone,
                        Email = cDef.Email,
                        Address = cDef.Address,
                        Created = nowUtc.AddMonths(-3),
                        CreatedBy = "SystemSeed"
                    };
                    await context.Customers.AddAsync(existingCust);
                }
                customers.Add(existingCust);
            }
            await context.SaveChangesAsync();

            // 4. Товари (20 еталонних позицій із products_import_sample.csv)
            var productDefs = new[]
            {
                new { Sku = "SKU-TP-E14", Name = "Ноутбук Lenovo ThinkPad E14", Desc = "14\" FHD IPS Core i5-1335U 16GB 512GB SSD", Price = 32999.00m, Qty = 12, Unit = "шт", Cat = "Ноутбуки", MinStock = 3, Supp = "techno", Sales = new[] { 2, 1, 3, 2, 1 } },
                new { Sku = "SKU-MBA-M2", Name = "Ноутбук Apple MacBook Air 13\" M2", Desc = "13.6\" Liquid Retina 8-core CPU 8GB 256GB SSD Midnight", Price = 43499.00m, Qty = 7, Unit = "шт", Cat = "Ноутбуки", MinStock = 2, Supp = "techno", Sales = new[] { 1, 2, 1, 1, 2 } },
                new { Sku = "SKU-TUF-A15", Name = "Ноутбук ASUS TUF Gaming A15", Desc = "15.6\" 144Hz Ryzen 7 7735HS RTX 4060 16GB 512GB", Price = 45999.00m, Qty = 4, Unit = "шт", Cat = "Ноутбуки", MinStock = 3, Supp = "techno", Sales = new[] { 2, 2, 1, 2, 1 } },
                new { Sku = "SKU-S24-256", Name = "Смартфон Samsung Galaxy S24", Desc = "6.2\" Dynamic AMOLED 2X 8GB 256GB Onyx Black", Price = 34999.00m, Qty = 15, Unit = "шт", Cat = "Смартфони", MinStock = 4, Supp = "techno", Sales = new[] { 3, 2, 4, 3, 2 } },
                new { Sku = "SKU-IP15P-128", Name = "Смартфон Apple iPhone 15 Pro", Desc = "6.1\" Super Retina XDR 128GB Natural Titanium", Price = 47999.00m, Qty = 5, Unit = "шт", Cat = "Смартфони", MinStock = 3, Supp = "techno", Sales = new[] { 2, 3, 2, 1, 2 } },
                new { Sku = "SKU-RN13P-256", Name = "Смартфон Xiaomi Redmi Note 13 Pro", Desc = "6.67\" AMOLED 200MP 8GB 256GB Midnight Black", Price = 10499.00m, Qty = 22, Unit = "шт", Cat = "Смартфони", MinStock = 5, Supp = "techno", Sales = new[] { 4, 5, 3, 6, 4 } },
                new { Sku = "SKU-DELL-U27", Name = "Монітор Dell UltraSharp U2724D", Desc = "27\" IPS QHD 120Hz 100% sRGB HDMI DP Type-C", Price = 16899.00m, Qty = 8, Unit = "шт", Cat = "Монітори", MinStock = 2, Supp = "areo", Sales = new[] { 1, 2, 1, 3, 1 } },
                new { Sku = "SKU-SAM-G5", Name = "Монітор Samsung Odyssey G5", Desc = "27\" VA WQHD 165Hz Curved 1000R 1ms HDR10", Price = 9999.00m, Qty = 2, Unit = "шт", Cat = "Монітори", MinStock = 3, Supp = "areo", Sales = new[] { 2, 3, 2, 2, 1 } },
                new { Sku = "SKU-LOG-MX3S", Name = "Бездротова миша Logitech MX Master 3S", Desc = "Лазерний сенсор 8000 DPI MagSpeed Bluetooth USB-C", Price = 4199.00m, Qty = 18, Unit = "шт", Cat = "Периферія", MinStock = 5, Supp = "areo", Sales = new[] { 3, 4, 2, 5, 3 } },
                new { Sku = "SKU-KEY-K2", Name = "Механічна клавіатура Keychron K2 V2", Desc = "RGB Hot-Swap Wireless Gateron Brown 75%", Price = 3899.00m, Qty = 9, Unit = "шт", Cat = "Периферія", MinStock = 3, Supp = "areo", Sales = new[] { 2, 1, 3, 2, 2 } },
                new { Sku = "SKU-HYP-C3W", Name = "Гарнітура HyperX Cloud III Wireless", Desc = "Бездротова ігрова гарнітура 2.4GHz до 120 год роботи", Price = 5999.00m, Qty = 6, Unit = "шт", Cat = "Периферія", MinStock = 2, Supp = "areo", Sales = new[] { 1, 2, 1, 2, 1 } },
                new { Sku = "SKU-SSD-990P", Name = "SSD накопичувач Samsung 990 PRO 1TB", Desc = "M.2 NVMe PCIe 4.0 швидкість до 7450 МБ/с", Price = 4499.00m, Qty = 25, Unit = "шт", Cat = "Комплектуючі", MinStock = 5, Supp = "itlog", Sales = new[] { 5, 6, 4, 7, 5 } },
                new { Sku = "SKU-RAM-KF5", Name = "Оперативна пам'ять Kingston Fury Beast 32GB", Desc = "DDR5-6000 MHz CL36 (2x16GB) Expo/XMP", Price = 4999.00m, Qty = 14, Unit = "комплект", Cat = "Комплектуючі", MinStock = 4, Supp = "itlog", Sales = new[] { 3, 2, 4, 3, 2 } },
                new { Sku = "SKU-ASUS-4070", Name = "Відеокарта ASUS Dual GeForce RTX 4070", Desc = "12GB GDDR6X DLSS 3 192-bit OC Edition", Price = 26999.00m, Qty = 3, Unit = "шт", Cat = "Комплектуючі", MinStock = 2, Supp = "itlog", Sales = new[] { 1, 2, 1, 1, 1 } },
                new { Sku = "SKU-MT-AX3", Name = "Wi-Fi роутер MikroTik hAP ax3", Desc = "Дводіапазонний Wi-Fi 6 2.5GbE PoE RouterOS L6", Price = 5399.00m, Qty = 11, Unit = "шт", Cat = "Мережеве обладнання", MinStock = 3, Supp = "net", Sales = new[] { 2, 3, 1, 2, 2 } },
                new { Sku = "SKU-TPL-SG108", Name = "Комутатор TP-Link TL-SG108E", Desc = "8-портовий гігабітний Easy Smart комутатор металевий", Price = 1299.00m, Qty = 16, Unit = "шт", Cat = "Мережеве обладнання", MinStock = 4, Supp = "net", Sales = new[] { 3, 2, 4, 3, 2 } },
                new { Sku = "SKU-CAN-MF3010", Name = "БФП лазерний Canon i-SENSYS MF3010", Desc = "Чорно-білий лазерний принтер/сканер/копір", Price = 9499.00m, Qty = 1, Unit = "шт", Cat = "Офісна техніка", MinStock = 2, Supp = "areo", Sales = new[] { 1, 1, 1, 1, 1 } },
                new { Sku = "SKU-APC-650", Name = "Джерело безперебійного живлення APC Back-UPS 650VA", Desc = "Резервне живлення для ПК та роутера 4 розетки", Price = 3799.00m, Qty = 0, Unit = "шт", Cat = "Офісна техніка", MinStock = 2, Supp = "areo", Sales = new[] { 1, 2, 1, 2, 1 } },
                new { Sku = "SKU-PC-C6-15", Name = "Патч-корд Cat 6 UTP 1.5м", Desc = "Мережевий кабель литий мідний сірий", Price = 65.00m, Qty = 45, Unit = "шт", Cat = "Мережеве обладнання", MinStock = 10, Supp = "net", Sales = new[] { 10, 15, 12, 18, 15 } },
                new { Sku = "SKU-ARC-MX4", Name = "Термопаста Arctic MX-4 4g", Desc = "Високоефективна теплопровідна паста для процесорів", Price = 249.00m, Qty = 0, Unit = "шт", Cat = "Комплектуючі", MinStock = 5, Supp = "itlog", Sales = new[] { 3, 4, 2, 5, 3 } }
            };

            var dayOffsets = new[] { 26, 20, 15, 9, 3 };

            foreach (var pDef in productDefs)
            {
                var category = categories[pDef.Cat];
                var supplier = suppliers[pDef.Supp];
                var totalSales = pDef.Sales.Sum();
                var initialArrivalQty = pDef.Qty + totalSales;

                var product = new Product
                {
                    Id = Guid.NewGuid(),
                    SKU = pDef.Sku,
                    Name = pDef.Name,
                    Description = pDef.Desc,
                    Unit = pDef.Unit,
                    Price = pDef.Price,
                    MinStock = pDef.MinStock,
                    Quantity = pDef.Qty,
                    CategoryId = category.Id,
                    CreatedAt = nowUtc.AddDays(-35)
                };
                await context.Products.AddAsync(product);

                // 5.1. Початкове оприбуткування від постачальника (35 днів тому)
                var inMovement = new StockMovement
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    MovementDate = nowUtc.AddDays(-35),
                    Type = MovementType.In,
                    Quantity = initialArrivalQty,
                    SupplierId = supplier.Id,
                    Note = $"Оприбуткування партії від постачальника {supplier.Name} (Накладна ПН-2026/{product.SKU})"
                };
                await context.StockMovements.AddAsync(inMovement);

                var inHistory = new ProductHistory
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    Change = initialArrivalQty,
                    StockAfter = initialArrivalQty,
                    Note = $"Оприбуткування товару (ПН-2026/{product.SKU})",
                    UserName = "admin",
                    CreatedAt = nowUtc.AddDays(-35)
                };
                await context.ProductHistories.AddAsync(inHistory);

                // 5.2. Серія відвантажень (продажів) клієнтам за останні 30 днів
                int runningStock = initialArrivalQty;
                for (int i = 0; i < pDef.Sales.Length; i++)
                {
                    var saleQty = pDef.Sales[i];
                    var dayOffset = dayOffsets[i % dayOffsets.Length];
                    var customer = customers[i % customers.Count];

                    runningStock -= saleQty;

                    var outMovement = new StockMovement
                    {
                        Id = Guid.NewGuid(),
                        ProductId = product.Id,
                        MovementDate = nowUtc.AddDays(-dayOffset),
                        Type = MovementType.Out,
                        Quantity = saleQty,
                        CustomerId = customer.Id,
                        Note = $"Видаткова накладна № ВН-{pDef.Sku.Replace("SKU-", "")}/{i + 1} ({customer.Name})"
                    };
                    await context.StockMovements.AddAsync(outMovement);

                    var outHistory = new ProductHistory
                    {
                        Id = Guid.NewGuid(),
                        ProductId = product.Id,
                        Change = -saleQty,
                        StockAfter = runningStock,
                        Note = $"Видача замовнику {customer.Name}",
                        UserName = "admin",
                        CreatedAt = nowUtc.AddDays(-dayOffset)
                    };
                    await context.ProductHistories.AddAsync(outHistory);
                }
            }

            await context.SaveChangesAsync();
            logger.LogInformation("✅ Успішно наповнено БД демонстраційними даними: 20 товарів, 7 категорій, 4 постачальники, 3 клієнти та 120 складських операцій.");
        }
    }
}

