using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using Inventory.Application.Common.Models.ML;

namespace Inventory.Application.Common.Models.Copilot
{
    public class ChatMessageDto
    {
        [JsonPropertyName("role")]
        public string Role { get; set; } = "user";

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;
    }

    public class CopilotActionDto
    {
        [JsonPropertyName("label")]
        public string Label { get; set; } = string.Empty;

        [JsonPropertyName("action_type")]
        public string ActionType { get; set; } = string.Empty;

        [JsonPropertyName("payload")]
        public string? Payload { get; set; }
    }

    public class CopilotChatRequestDto
    {
        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;

        [JsonPropertyName("history")]
        public List<ChatMessageDto>? History { get; set; }

        [JsonPropertyName("products")]
        public List<WarehouseProductInputDto>? Products { get; set; }

        [JsonPropertyName("api_key")]
        public string? ApiKey { get; set; }

        [JsonPropertyName("provider")]
        public string Provider { get; set; } = "auto";
    }

    public class CopilotChatResponseDto
    {
        [JsonPropertyName("reply")]
        public string Reply { get; set; } = string.Empty;

        [JsonPropertyName("intent")]
        public string Intent { get; set; } = "general";

        [JsonPropertyName("actions")]
        public List<CopilotActionDto> Actions { get; set; } = new();

        [JsonPropertyName("model_used")]
        public string ModelUsed { get; set; } = string.Empty;

        [JsonPropertyName("generated_at")]
        public string GeneratedAt { get; set; } = string.Empty;
    }
}
