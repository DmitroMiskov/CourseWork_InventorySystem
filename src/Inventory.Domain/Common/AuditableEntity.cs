using System;

namespace Inventory.Domain.Common
{
    public abstract class AuditableEntity
    {
        // Усі таблиці автоматично отримають ID
        public Guid Id { get; set; }

        // Поля для аудиту (хто і коли створив)
        public DateTime Created { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? LastModified { get; set; }
        public string? LastModifiedBy { get; set; }
    }
}