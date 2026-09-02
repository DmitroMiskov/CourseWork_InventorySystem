# Етап 1: Відновлення пакетів та компіляція
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build
WORKDIR /src

# Копіюємо спільні налаштування та файли проєктів окремо для кешування шарів
COPY Directory.Build.props ./
COPY src/Inventory.Domain/Inventory.Domain.csproj src/Inventory.Domain/
COPY src/Inventory.Application/Inventory.Application.csproj src/Inventory.Application/
COPY src/Inventory.Infrastructure/Inventory.Infrastructure.csproj src/Inventory.Infrastructure/
COPY src/Inventory.API/Inventory.API.csproj src/Inventory.API/

# Відновлюємо залежності NuGet без копіювання вихідного коду
RUN dotnet restore src/Inventory.API/Inventory.API.csproj

# Копіюємо весь інший вихідний код
COPY src/ src/

# Збираємо та публікуємо релізну оптимізовану версію
WORKDIR /src/src/Inventory.API
RUN dotnet publish Inventory.API.csproj -c Release -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# Етап 2: Фінальний мінімальний образ для виконання
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine AS final
WORKDIR /app

# Налаштування порту та оптимізації Globalization під Alpine
ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=true

# Встановлюємо користувача без root-прав для безпеки
USER $APP_UID

# Копіюємо виключно бінарні файли з етапу збірки
COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "Inventory.API.dll"]