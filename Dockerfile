# Етап 1: Збірка (Build)
# 👇 ЗМІНЕНО: Використовуємо 9.0
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Копіюємо файли проєктів
COPY ["src/Inventory.API/Inventory.API.csproj", "src/Inventory.API/"]
COPY ["src/Inventory.Application/Inventory.Application.csproj", "src/Inventory.Application/"]
COPY ["src/Inventory.Domain/Inventory.Domain.csproj", "src/Inventory.Domain/"]
COPY ["src/Inventory.Infrastructure/Inventory.Infrastructure.csproj", "src/Inventory.Infrastructure/"]

# Відновлюємо залежності
RUN dotnet restore "src/Inventory.API/Inventory.API.csproj"

# Копіюємо решту коду і збираємо
COPY . .
WORKDIR "/src/src/Inventory.API"
RUN dotnet build "Inventory.API.csproj" -c Release -o /app/build

# Публікуємо
FROM build AS publish
RUN dotnet publish "Inventory.API.csproj" -c Release -o /app/publish

# Етап 2: Запуск (Run)
# 👇 ЗМІНЕНО: Використовуємо 9.0
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Inventory.API.dll"]