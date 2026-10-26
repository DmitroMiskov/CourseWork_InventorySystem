using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Inventory.API.Controllers;
using Inventory.API.Models;
using Inventory.API.Services;
using Inventory.Domain.Entities;
using Inventory.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Inventory.Tests
{
    public class NotificationAndAlertTests
    {
        private ApplicationDbContext CreateInMemoryContext()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            return new ApplicationDbContext(options);
        }

        private class MockHttpClientFactory : IHttpClientFactory
        {
            private readonly HttpStatusCode _statusCode;

            public MockHttpClientFactory(HttpStatusCode statusCode = HttpStatusCode.OK)
            {
                _statusCode = statusCode;
            }

            public HttpClient CreateClient(string name)
            {
                var handler = new MockHttpMessageHandler(_statusCode);
                return new HttpClient(handler);
            }
        }

        private class MockHttpMessageHandler : HttpMessageHandler
        {
            private readonly HttpStatusCode _statusCode;

            public MockHttpMessageHandler(HttpStatusCode statusCode)
            {
                _statusCode = statusCode;
            }

            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                return Task.FromResult(new HttpResponseMessage(_statusCode)
                {
                    Content = new StringContent("{\"ok\":true}")
                });
            }
        }

        private class FakeNotifier : IInventoryNotifier
        {
            public List<string> Messages { get; } = new();

            public Task NotifyGeneralAsync(string title, string message, string severity = "info")
            {
                Messages.Add($"{title}: {message}");
                return Task.CompletedTask;
            }

            public Task NotifyLowStockAsync(API.Hubs.LowStockAlertEvent alert)
            {
                Messages.Add($"LowStock: {alert.ProductName}");
                return Task.CompletedTask;
            }

            public Task NotifyProductChangeAsync(API.Hubs.ProductChangeEvent change)
            {
                Messages.Add($"ProductChange: {change.Action}");
                return Task.CompletedTask;
            }

            public Task NotifyStockMovementAsync(API.Hubs.StockMovementEvent movement)
            {
                Messages.Add($"StockMovement: {movement.ProductName}");
                return Task.CompletedTask;
            }
        }

        [Fact]
        public void TelegramAlertService_WhenUnconfigured_IsConfiguredIsFalse()
        {
            var config = new ConfigurationBuilder().Build();
            var factory = new MockHttpClientFactory();
            var service = new TelegramAlertService(factory, config, NullLogger<TelegramAlertService>.Instance);

            Assert.False(service.IsConfigured);
            Assert.False(service.IsEnabled);
        }

        [Fact]
        public void TelegramAlertService_UpdateSettings_MasksTokenCorrectly()
        {
            var config = new ConfigurationBuilder().Build();
            var factory = new MockHttpClientFactory();
            var service = new TelegramAlertService(factory, config, NullLogger<TelegramAlertService>.Instance);

            service.UpdateSettings("123456789:ABCdefGHIjklMNOpqrsTUVwxyz", "-1001234567890", true, true);

            Assert.True(service.IsConfigured);
            Assert.True(service.IsEnabled);

            var settings = service.GetSettings();
            Assert.Contains("***", settings.BotToken);
            Assert.Equal("-1001234567890", settings.ChatId);
        }

        [Fact]
        public async Task TelegramAlertService_SendTestMessage_CallsHttpClientSuccessfully()
        {
            var config = new ConfigurationBuilder().Build();
            var factory = new MockHttpClientFactory(HttpStatusCode.OK);
            var service = new TelegramAlertService(factory, config, NullLogger<TelegramAlertService>.Instance);

            service.UpdateSettings("123456789:ABCdefGHIjklMNOpqrsTUVwxyz", "-1001234567890", true, true);

            var success = await service.SendTestMessageAsync();
            Assert.True(success);
        }

        [Fact]
        public async Task NotificationsController_GetActiveAlerts_ReturnsOnlyLowOrOutStockItems()
        {
            using var context = CreateInMemoryContext();
            var category = new Category { Id = Guid.NewGuid(), Name = "Електроніка" };
            context.Categories.Add(category);

            // 1. Normal stock
            context.Products.Add(new Product
            {
                Id = Guid.NewGuid(),
                SKU = "PROD-OK",
                Name = "Товар в нормі",
                Quantity = 50,
                MinStock = 5,
                CategoryId = category.Id,
                Unit = "шт",
                Price = 100m
            });

            // 2. Low stock
            context.Products.Add(new Product
            {
                Id = Guid.NewGuid(),
                SKU = "PROD-LOW",
                Name = "Товар низький залишок",
                Quantity = 2,
                MinStock = 5,
                CategoryId = category.Id,
                Unit = "шт",
                Price = 200m
            });

            // 3. Out of stock (0)
            context.Products.Add(new Product
            {
                Id = Guid.NewGuid(),
                SKU = "PROD-ZERO",
                Name = "Товар закінчився",
                Quantity = 0,
                MinStock = 10,
                CategoryId = category.Id,
                Unit = "шт",
                Price = 500m
            });

            await context.SaveChangesAsync();

            var config = new ConfigurationBuilder().Build();
            var telegramService = new TelegramAlertService(new MockHttpClientFactory(), config, NullLogger<TelegramAlertService>.Instance);
            var notifier = new FakeNotifier();

            var controller = new NotificationsController(context, notifier, telegramService);

            var result = await controller.GetActiveAlerts();
            var okResult = Assert.IsType<OkObjectResult>(result.Result);

            var data = Assert.IsType<Inventory.API.Dtos.ActiveAlertsSummaryDto>(okResult.Value);
            Assert.Equal(2, data.TotalAlerts);
            Assert.Equal(1, data.OutStockCount);
            Assert.Equal(1, data.LowStockCount);
        }

        [Fact]
        public async Task NotificationsController_Broadcast_NotifiesAllUsers()
        {
            using var context = CreateInMemoryContext();
            var config = new ConfigurationBuilder().Build();
            var telegramService = new TelegramAlertService(new MockHttpClientFactory(), config, NullLogger<TelegramAlertService>.Instance);
            var notifier = new FakeNotifier();

            var controller = new NotificationsController(context, notifier, telegramService);

            var result = await controller.Broadcast(new NotificationsController.BroadcastNotificationDto
            {
                Title = "Технічні роботи",
                Message = "Сервер перезавантажиться через 5 хвилин",
                Severity = "warning"
            });

            var okResult = Assert.IsType<OkObjectResult>(result);
            Assert.Single(notifier.Messages);
            Assert.Contains("Технічні роботи", notifier.Messages[0]);
        }
    }
}
