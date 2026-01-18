using Inventory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Inventory.Application.Common.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ==========================================
// 1. РЕЄСТРАЦІЯ СЕРВІСІВ (Все робимо ДО builder.Build)
// ==========================================

// 1.1 Контролери та JSON
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

// 1.2 Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 1.3 CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        builder => builder.AllowAnyOrigin()
                          .AllowAnyMethod()
                          .AllowAnyHeader());
});

// 1.4 База даних
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<IApplicationDbContext>(provider =>
    provider.GetRequiredService<ApplicationDbContext>());

// 1.5 MediatR
builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssembly(typeof(Inventory.Application.Products.Commands.CreateProduct.CreateProductCommand).Assembly));

// 1.6 Identity (Користувачі та Ролі)
builder.Services.AddIdentity<IdentityUser, IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// 1.7 JWT Authentication (ПЕРЕНЕСЕНО СЮДИ - ЦЕ БУЛО ПОМИЛКОЮ)
var key = Encoding.ASCII.GetBytes("TUT_DUZHE_SECRETNY_KEY_DLYA_KURSOVOI_ROBOTY_12345");
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false
    };
});

// ==========================================
// 2. БУДУЄМО ПРОГРАМУ (Після цього builder.Services чіпати не можна!)
// ==========================================
var app = builder.Build();

// ==========================================
// 3. МІГРАЦІЇ ТА НАЛАШТУВАННЯ PIPELINE
// ==========================================

// Автоматична міграція бази даних
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        
        //context.Database.EnsureDeleted(); 
        
        // Цей рядок створює базу наново вже з колонкою ImageUrl
        context.Database.EnsureCreated(); 
        
        Console.WriteLine("✅ База даних успішно перестворена.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Помилка при оновленні бази даних: {ex.Message}");
    }
}

// Pipeline
app.UseSwagger();
app.UseSwaggerUI();

//app.UseHttpsRedirection();

app.UseCors("AllowAll");

// Порядок важливий!
app.UseAuthentication();
app.UseAuthorization(); 

app.UseStaticFiles();

app.MapControllers();

app.Run();