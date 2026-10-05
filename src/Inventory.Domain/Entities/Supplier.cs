using Inventory.Domain.Common;

namespace Inventory.Domain.Entities
{
    public class Supplier : AuditableEntity
    {
        public string Name { get; set; } = string.Empty;
        public string ContactPerson { get; set; } = string.Empty; // Ім'я менеджера
        public string Phone { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Edrpou { get; set; } = string.Empty;         // Код ЄДРПОУ / ІПН
        public string Address { get; set; } = string.Empty;        // Адреса офісу / складу
        public int LeadTimeDays { get; set; } = 5;                 // Плече поставки (днів) для розрахунків ROP/SS
        public string ContractNumber { get; set; } = string.Empty; // Номер та дата чинного договору
        public string PaymentTerms { get; set; } = string.Empty;   // Умови оплати
    }
}