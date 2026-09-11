using Inventory.Domain.Enums;
using System.Text.Json.Serialization;

namespace Inventory.API.Dtos
{
    public class CreateMovementDto
    {
        public Guid ProductId { get; set; }
        
        public MovementType Type { get; set; }

        [JsonPropertyName("movementType")]
        public MovementType? MovementType
        {
            get => Type;
            set
            {
                if (value.HasValue && value.Value != Domain.Enums.MovementType.None)
                {
                    Type = value.Value;
                }
            }
        }

        public int Quantity { get; set; }
        public string? Reason { get; set; }
        public Guid? SupplierId { get; set; }
        public Guid? CustomerId { get; set; }
    }
}
