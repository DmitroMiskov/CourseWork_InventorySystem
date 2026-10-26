namespace Inventory.API.Models
{
    public class TelegramSettings
    {
        public string BotToken { get; set; } = string.Empty;
        public string ChatId { get; set; } = string.Empty;
        public bool Enabled { get; set; } = false;
        public bool NotifyOnLowStock { get; set; } = true;
    }
}
