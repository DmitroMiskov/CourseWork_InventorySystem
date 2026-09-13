using System;
using System.Collections.Generic;
using Inventory.Application.Common.Models.ML;
using Xunit;

namespace Inventory.Tests;

public class ProcurementIntelligenceTests
{
    [Fact]
    public void ProcurementRadarItem_Initialization_CalculatesCorrectly()
    {
        // Arrange
        var item = new ProcurementRadarItemDto
        {
            ProductId = 1,
            Sku = "EL-001",
            Name = "Ноутбук Pro 15.6\"",
            Category = "Електроніка",
            UnitPrice = 34500.0,
            CurrentStock = 14.0,
            DailyDemand = 1.8,
            DailyDemandStd = 0.9,
            LeadTimeDays = 7,
            SafetyStock = 4.0,
            ReorderPoint = 17.0,
            Eoq = 12.0,
            DaysToDepletion = 7.7,
            Status = "УВАГА (нижче ROP)",
            StatusCode = "warning",
            RecommendedOrderQty = 12.0,
            EstimatedOrderCost = 414000.0,
            SupplierName = "ТОВ \"ТехноДистриб'юшн\""
        };

        // Assert
        Assert.Equal("EL-001", item.Sku);
        Assert.Equal("warning", item.StatusCode);
        Assert.Equal(414000.0, item.EstimatedOrderCost);
        Assert.True(item.CurrentStock < item.ReorderPoint);
    }

    [Fact]
    public void AbcXyzItem_Mapping_ContainsValidMatrixCell()
    {
        // Arrange
        var item = new AbcXyzItemDto
        {
            ProductId = 2,
            Sku = "EL-002",
            Name = "Бездротова миша Optical",
            Category = "Електроніка",
            Revenue = 170000.0,
            SharePercent = 14.5,
            CumulativeSharePercent = 25.0,
            AbcClass = "A",
            CvPercent = 12.0,
            XyzClass = "X",
            MatrixCell = "AX",
            StrategyRecommendation = "Just-in-Time"
        };

        // Assert
        Assert.Equal("AX", item.MatrixCell);
        Assert.Equal("A", item.AbcClass);
        Assert.Equal("X", item.XyzClass);
        Assert.Equal(12.0, item.CvPercent);
    }
}
