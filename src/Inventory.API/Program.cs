using Inventory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Inventory.Application.Common.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ==========================================
// 1. РЕЄСТРАЦІЯ СЕРВІСІВ
// ==========================================

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        builder => builder.AllowAnyOrigin()
                          .AllowAnyMethod()
                          .AllowAnyHeader());
});

// 👇 ВИПРАВЛЕННЯ: Змінили Npgsql на SqlServer для Azure
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<IApplicationDbContext>(provider =>
    provider.GetRequiredService<ApplicationDbContext>());

builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssembly(typeof(Inventory.Application.Products.Commands.CreateProduct.CreateProductCommand).Assembly));

builder.Services.AddIdentity<IdentityUser, IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

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
// 2. БУДУЄМО ПРОГРАМУ
// ==========================================
var app = builder.Build();

// ==========================================
// 3. МІГРАЦІЇ ТА PIPELINE
// ==========================================

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        // context.Database.EnsureDeleted(); // Обережно з цим на проді!
        context.Database.EnsureCreated(); 
        Console.WriteLine("✅ База даних успішно ініціалізована.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Помилка при ініціалізації БД: {ex.Message}");
    }
}

// 👇 SWAGGER ВКЛЮЧЕНИЙ ЗАВЖДИ (без if IsDevelopment)
app.UseSwagger();
app.UseSwaggerUI(c => 
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Inventory API V1");
    c.RoutePrefix = "swagger"; // Це стандартно, але про всяк випадок
});

app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization(); 

app.UseStaticFiles();

app.MapControllers();

app.Run();