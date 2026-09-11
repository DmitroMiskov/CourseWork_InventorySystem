namespace Inventory.API.Dtos
{
    public class PartnerDto
    {
        public Guid? Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? ContactInfo { get; set; }
    }
}
