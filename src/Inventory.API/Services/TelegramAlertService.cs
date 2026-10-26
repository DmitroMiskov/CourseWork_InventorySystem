using System.Text;
using System.Text.Json;
using Inventory.API.Models;

namespace Inventory.API.Services
{
    public class TelegramAlertService : ITelegramAlertService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<TelegramAlertService> _logger;
        private TelegramSettings _settings;

        public TelegramAlertService(
            IHttpClientFactory httpClientFactory, 
            IConfiguration configuration, 
            ILogger<TelegramAlertService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;

            _settings = new TelegramSettings
            {
                BotToken = configuration["Telegram:BotToken"] ?? string.Empty,
                ChatId = configuration["Telegram:ChatId"] ?? string.Empty,
                Enabled = bool.TryParse(configuration["Telegram:Enabled"], out var enabled) && enabled,
                NotifyOnLowStock = !bool.TryParse(configuration["Telegram:NotifyOnLowStock"], out var notify) || notify
            };
        }

        public bool IsConfigured => !string.IsNullOrWhiteSpace(_settings.BotToken) && !string.IsNullOrWhiteSpace(_settings.ChatId);

        public bool IsEnabled => IsConfigured && _settings.Enabled;

        public TelegramSettings GetSettings()
        {
            return new TelegramSettings
            {
                BotToken = string.IsNullOrWhiteSpace(_settings.BotToken) ? string.Empty : MaskToken(_settings.BotToken),
                ChatId = _settings.ChatId,
                Enabled = _settings.Enabled,
                NotifyOnLowStock = _settings.NotifyOnLowStock
            };
        }

        public void UpdateSettings(string botToken, string chatId, bool enabled, bool notifyOnLowStock)
        {
            // If user supplied a masked token, preserve existing one
            var effectiveToken = botToken.Contains("***") 
                ? _settings.BotToken 
                : botToken.Trim();

            _settings = new TelegramSettings
            {
                BotToken = effectiveToken,
                ChatId = chatId.Trim(),
                Enabled = enabled,
                NotifyOnLowStock = notifyOnLowStock
            };

            _logger.LogInformation("Telegram alert settings updated. Enabled: {Enabled}, ChatId: {ChatId}", _settings.Enabled, _settings.ChatId);
        }

        public async Task<bool> SendMessageAsync(string htmlText)
        {
            if (!IsConfigured)
            {
                _logger.LogWarning("Telegram alerting is not configured (missing BotToken or ChatId)");
                return false;
            }

            try
            {
                var url = $"https://api.telegram.org/bot{_settings.BotToken}/sendMessage";
                var payload = new
                {
                    chat_id = _settings.ChatId,
                    text = htmlText,
                    parse_mode = "HTML"
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var client = _httpClientFactory.CreateClient("TelegramAlerts");
                client.Timeout = TimeSpan.FromSeconds(10);
                var response = await client.PostAsync(url, content);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Telegram notification sent successfully to chat {ChatId}", _settings.ChatId);
                    return true;
                }

                var responseBody = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to send Telegram message. Status: {StatusCode}, Response: {Response}", response.StatusCode, responseBody);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while sending Telegram message");
                return false;
            }
        }

        public async Task<bool> SendLowStockAlertAsync(string productName, int currentStock, int minStock)
        {
            if (!IsEnabled || !_settings.NotifyOnLowStock)
            {
                return false;
            }

            var time = DateTime.UtcNow.ToString("dd.MM.yyyy HH:mm:ss");
            var sb = new StringBuilder();
            sb.AppendLine("🚨 <b>УВАГА: Критичний залишок на складі!</b>");
            sb.AppendLine();
            sb.AppendLine($"📦 <b>Товар:</b> <code>{EscapeHtml(productName)}</code>");
            sb.AppendLine($"📉 <b>Поточний залишок:</b> <b>{currentStock} шт.</b>");
            sb.AppendLine($"⚠️ <b>Мінімальний поріг (MinStock):</b> <b>{minStock} шт.</b>");
            sb.AppendLine($"🕒 <b>Час фіксації:</b> {time} UTC");
            sb.AppendLine();
            sb.AppendLine("<i>Рекомендовано створити замовлення постачальнику через «Радар закупівель».</i>");

            return await SendMessageAsync(sb.ToString());
        }

        public async Task<bool> SendTestMessageAsync()
        {
            var time = DateTime.UtcNow.ToString("dd.MM.yyyy HH:mm:ss");
            var sb = new StringBuilder();
            sb.AppendLine("🔔 <b>Тестове сповіщення від InventorySystem</b>");
            sb.AppendLine();
            sb.AppendLine("✅ Канал сповіщень Telegram успішно налаштований та працює належним чином.");
            sb.AppendLine($"🕒 <b>Час відправки:</b> {time} UTC");
            sb.AppendLine("🏢 <b>Система:</b> Warehouse DSS & Inventory System");

            return await SendMessageAsync(sb.ToString());
        }

        private static string EscapeHtml(string text)
        {
            if (string.IsNullOrEmpty(text)) return string.Empty;
            return text
                .Replace("&", "&amp;")
                .Replace("<", "&lt;")
                .Replace(">", "&gt;")
                .Replace("\"", "&quot;");
        }

        private static string MaskToken(string token)
        {
            if (token.Length <= 8) return "********";
            return $"{token.Substring(0, 4)}***{token.Substring(token.Length - 4)}";
        }
    }
}
