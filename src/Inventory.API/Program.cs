using Inventory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Inventory.Application.Common.Interfaces;


var builder = WebApplication.CreateBuilder(args);

// 1. ПІДКЛЮЧАЄМО КОНТРОЛЕРИ (щоб ваш ProductsController запрацював)
// Додаємо опцію ReferenceHandler.IgnoreCycles, щоб розірвати замкнене коло
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

// 2. НАЛАШТУВАННЯ SWAGGER (для візуального інтерфейсу)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 3. ДОДАЄМО CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        builder => builder.AllowAnyOrigin()
                          .AllowAnyMethod()
                          .AllowAnyHeader());
});

// 4. ПІДКЛЮЧЕННЯ БАЗИ ДАНИХ (Залишаємо як було)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<IApplicationDbContext>(provider =>
    provider.GetRequiredService<ApplicationDbContext>());

builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssembly(typeof(Inventory.Application.Products.Commands.CreateProduct.CreateProductCommand).Assembly));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        // Ця команда застосує всі міграції (створить таблиці), якщо їх ще немає
        context.Database.Migrate();
        Console.WriteLine("✅ База даних успішно оновлена (міграції застосовані).");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Помилка при оновленні бази даних: {ex.Message}");
    }
}

// 4. НАЛАШТУВАННЯ PIPELINE
// Вмикаємо Swagger для зручності навіть не в Development режимі
app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

app.UseCors("AllowAll");

app.UseAuthorization();

// Найголовніше: мапимо контролери
app.MapControllers();

app.Run();