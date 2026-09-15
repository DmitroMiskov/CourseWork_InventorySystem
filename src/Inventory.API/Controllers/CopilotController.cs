using System.Threading;
using System.Threading.Tasks;
using Inventory.Application.Common.Interfaces;
using Inventory.Application.Common.Models.Copilot;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Inventory.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CopilotController : ControllerBase
    {
        private readonly ICopilotService _copilotService;

        public CopilotController(ICopilotService copilotService)
        {
            _copilotService = copilotService;
        }

        /// <summary>
        /// Діалог з інтелектуальним AI-асистентом складу (Copilot)
        /// Поєднує аналіз складських залишків, Explainable AI та генерацію рішень
        /// </summary>
        [HttpPost("chat")]
        public async Task<IActionResult> Chat(
            [FromBody] CopilotChatRequestDto request, 
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request?.Message))
            {
                return BadRequest(new { message = "Повідомлення не може бути порожнім." });
            }

            var response = await _copilotService.ProcessChatAsync(request, cancellationToken);
            return Ok(response);
        }
    }
}
