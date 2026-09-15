using System.Threading;
using System.Threading.Tasks;
using Inventory.Application.Common.Models.Copilot;

namespace Inventory.Application.Common.Interfaces
{
    public interface ICopilotService
    {
        Task<CopilotChatResponseDto> ProcessChatAsync(
            CopilotChatRequestDto request, 
            CancellationToken cancellationToken = default);
    }
}
