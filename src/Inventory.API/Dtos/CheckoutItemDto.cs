namespace Inventory.API.Dtos
{
    public class CheckoutItemDto
    {
        public Guid ProductId { get; set; }
        public int Quantity { get; set; }
    }
}
