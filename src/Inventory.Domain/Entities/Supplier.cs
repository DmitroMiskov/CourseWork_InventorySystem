using Inventory.Domain.Common;

namespace Inventory.Domain.Entities
{
    public class Supplier : AuditableEntity
    {
        public string Name { get; set; } = string.Empty;
        public string ContactPerson { get; set; } = string.Empty; // Ім'я менеджера
        public string Phone { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }
}