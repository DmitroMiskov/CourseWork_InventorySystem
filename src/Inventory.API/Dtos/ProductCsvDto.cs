namespace Inventory.API.Dtos
{
    public class ProductCsvDto
    {
        public string Name { get; set; } = string.Empty;
        public string Sku { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int Quantity { get; set; }
        public string Unit { get; set; } = "шт";
        public int MinStock { get; set; }
        public string CategoryName { get; set; } = "Інше"; // Користувач вводить назву, а ми знайдемо ID
    }
}