namespace Inventory.Domain.Enums
{
    public enum PurchaseOrderStatus
    {
        Draft = 0,             // Чернетка
        PendingApproval = 1,   // Очікує затвердження
        Approved = 2,          // Затверджено керівником
        Sent = 3,              // Відправлено постачальнику (в дорозі)
        PartiallyReceived = 4, // Частково прийнято на склад
        Completed = 5,         // Повністю прийнято та виконано
        Cancelled = 6          // Скасовано
    }
}
