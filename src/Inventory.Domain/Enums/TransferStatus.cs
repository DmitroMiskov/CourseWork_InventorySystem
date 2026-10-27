namespace Inventory.Domain.Enums
{
    public enum TransferStatus
    {
        Draft = 0,      // Чернетка
        InTransit = 1,  // Відправлено / В дорозі між складами
        Completed = 2,  // Прийнято на складі-одержувачі
        Cancelled = 3   // Скасовано
    }
}
