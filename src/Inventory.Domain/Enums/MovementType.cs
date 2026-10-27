namespace Inventory.Domain.Enums
{
    public enum MovementType
    {
        None = 0,
        In = 1,        // Прихід (Закупівля/Оприбуткування)
        Out = 2,       // Розхід (Продаж/Списання)
        Transfer = 3   // Внутрішнє переміщення між складами
    }
}
