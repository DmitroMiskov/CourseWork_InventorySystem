# Етап 1: Відновлення пакетів та компіляція
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build
WORKDIR /src

# Копіюємо спільні налаштування та файли проєктів окремо для кешування шарів
COPY src/Directory.Build.props src/
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

# Етап 2: Фінальний мінімальний образ для виконання (Release на базі Alpine)
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine AS final
WORKDIR /app

# Встановлюємо icu-libs для повноцінної підтримки локалізації, валюти та дат
RUN apk add --no-cache icu-libs
ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false \
    LC_ALL=en_US.UTF-8 \
    LANG=en_US.UTF-8

# Створюємо директорію для зображень товарів і надаємо права безпечному користувачу
RUN mkdir -p /app/wwwroot/images && chown -R $APP_UID:$APP_UID /app/wwwroot

# Запуск з-під користувача без прав root
USER $APP_UID

# Копіюємо виключно бінарні файли з етапу збірки
COPY --from=build --chown=$APP_UID:$APP_UID /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "Inventory.API.dll"]