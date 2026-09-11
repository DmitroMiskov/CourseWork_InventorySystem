using Microsoft.AspNetCore.SignalR;

namespace Inventory.API.Hubs
{
    public class InventoryHub : Hub
    {
        private readonly ILogger<InventoryHub> _logger;

        public InventoryHub(ILogger<InventoryHub> logger)
        {
            _logger = logger;
        }

        public override async Task OnConnectedAsync()
        {
            var user = Context.User?.Identity?.Name ?? "Гість";
            _logger.LogInformation("SignalR: Клієнт підключився [{ConnectionId}], Користувач: {User}", Context.ConnectionId, user);
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            _logger.LogInformation("SignalR: Клієнт відключився [{ConnectionId}]", Context.ConnectionId);
            await base.OnDisconnectedAsync(exception);
        }

        public async Task Ping()
        {
            await Clients.Caller.SendAsync("Pong", DateTime.UtcNow);
        }
    }
}
