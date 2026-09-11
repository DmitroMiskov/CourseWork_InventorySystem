using Inventory.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;

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

                // 1. Створення стандартних ролей
                string[] roles = { "Admin", "User" };
                foreach (var role in roles)
                {
                    if (!await roleManager.RoleExistsAsync(role))
                    {
                        await roleManager.CreateAsync(new IdentityRole(role));
                        logger.LogInformation("✅ Роль '{Role}' створено.", role);
                    }
                }

                // 2. Створення / перевірка суперкористувача (Admin)
                var superuserConfig = configuration.GetSection("Superuser");
                var username = superuserConfig["Username"] ?? "admin";
                var password = superuserConfig["Password"] ?? "Admin123!";
                var email = superuserConfig["Email"] ?? "admin@inventory.local";
                var roleName = superuserConfig["Role"] ?? "Admin";
                var ensurePassword = configuration.GetValue<bool>("Superuser:EnsurePassword", true);

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
                        logger.LogInformation("✅ Суперкористувача '{Username}' успішно створено з роллю '{Role}'.", username, roleName);
                    }
                    else
                    {
                        var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                        logger.LogError("❌ Не вдалося створити суперкористувача '{Username}': {Errors}", username, errors);
                    }
                }
                else
                {
                    // Якщо користувач вже існує - гарантуємо, що у нього є роль Admin
                    if (!await userManager.IsInRoleAsync(user, roleName))
                    {
                        await userManager.AddToRoleAsync(user, roleName);
                        logger.LogInformation("✅ Роль '{Role}' призначено для суперкористувача '{Username}'.", roleName, username);
                    }

                    // Якщо увімкнено EnsurePassword та поточний пароль не підходить - скидаємо до дефолтного
                    if (ensurePassword && !await userManager.CheckPasswordAsync(user, password))
                    {
                        var resetToken = await userManager.GeneratePasswordResetTokenAsync(user);
                        var resetResult = await userManager.ResetPasswordAsync(user, resetToken, password);
                        if (resetResult.Succeeded)
                        {
                            logger.LogInformation("🔑 Пароль суперкористувача '{Username}' оновлено до гарантованого дефолтного.", username);
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
            catch (Exception ex)
            {
                logger.LogError(ex, "❌ Помилка під час ініціалізації суперкористувача та БД");
            }
        }
    }
}
