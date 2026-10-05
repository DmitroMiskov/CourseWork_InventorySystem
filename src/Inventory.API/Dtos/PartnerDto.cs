namespace Inventory.API.Dtos
{
    public class PartnerDto
    {
        public Guid? Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? ContactInfo { get; set; }
        public string? ContactPerson { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Edrpou { get; set; }
        public string? Address { get; set; }
        public int? LeadTimeDays { get; set; }
        public string? ContractNumber { get; set; }
        public string? PaymentTerms { get; set; }
    }
}
