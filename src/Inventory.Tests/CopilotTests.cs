using System;
using System.Collections.Generic;
using System.Text.Json;
using Inventory.Application.Common.Models.Copilot;
using Inventory.Application.Common.Models.ML;
using Xunit;

namespace Inventory.Tests;

public class CopilotTests
{
    [Fact]
    public void CopilotChatRequestDto_Serialization_WorksCorrectly()
    {
        // Arrange
        var request = new CopilotChatRequestDto
        {
            Message = "Що терміново треба замовити?",
            Provider = "auto",
            History = new List<ChatMessageDto>
            {
                new ChatMessageDto { Role = "user", Content = "Привіт" },
                new ChatMessageDto { Role = "assistant", Content = "Вітаю! Чим можу допомогти?" }
            },
            Products = new List<WarehouseProductInputDto>
            {
                new WarehouseProductInputDto
                {
                    ProductId = "1",
                    Sku = "MON-01",
                    Name = "Монітор 27\"",
                    UnitPrice = 9500.0,
                    CurrentStock = 1.0,
                    MinStock = 5.0,
                    SupplierName = "ТОВ \"ТехноДистриб'юшн\""
                }
            }
        };

        // Act
        var options = new JsonSerializerOptions
        {
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };
        var json = JsonSerializer.Serialize(request, options);

        // Assert
        Assert.Contains("Що терміново треба замовити?", json);
        Assert.Contains("MON-01", json);
        Assert.Contains("product_id", json);
        Assert.Contains("current_stock", json);
    }

    [Fact]
    public void CopilotChatResponseDto_Deserialization_ParsesActionsAndIntent()
    {
        // Arrange
        var rawJson = """
        {
            "reply": "### 🚨 Аудит дефіциту\n\nНеобхідно замовити монітори.",
            "intent": "urgent_procurement",
            "model_used": "Warehouse DSS Cognitive Engine (Автономний XAI-рушій)",
            "generated_at": "2026-09-15T10:00:00Z",
            "actions": [
                {
                    "label": "🎯 Відкрити Радар закупівель",
                    "action_type": "open_radar",
                    "payload": null
                },
                {
                    "label": "✉️ Скласти лист постачальнику",
                    "action_type": "quick_reply",
                    "payload": "Склади лист"
                }
            ]
        }
        """;

        // Act
        var response = JsonSerializer.Deserialize<CopilotChatResponseDto>(rawJson);

        // Assert
        Assert.NotNull(response);
        Assert.Equal("urgent_procurement", response.Intent);
        Assert.Contains("Аудит дефіциту", response.Reply);
        Assert.Equal(2, response.Actions.Count);
        Assert.Equal("open_radar", response.Actions[0].ActionType);
        Assert.Equal("quick_reply", response.Actions[1].ActionType);
    }
}
