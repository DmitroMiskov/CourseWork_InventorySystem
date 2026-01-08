using Inventory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 1. ПІДКЛЮЧАЄМО КОНТРОЛЕРИ (щоб ваш ProductsController запрацював)
builder.Services.AddControllers();

// 2. НАЛАШТУВАННЯ SWAGGER (для візуального інтерфейсу)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 3. ПІДКЛЮЧЕННЯ БАЗИ ДАНИХ (Залишаємо як було)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options => 
    options.UseNpgsql(connectionString));

var app = builder.Build();

// 4. НАЛАШТУВАННЯ PIPELINE
// Вмикаємо Swagger для зручності навіть не в Development режимі
app.UseSwagger();
app.UseSwaggerUI(); 

app.UseHttpsRedirection();

app.UseAuthorization();

// Найголовніше: мапимо контролери
app.MapControllers(); 

app.Run();