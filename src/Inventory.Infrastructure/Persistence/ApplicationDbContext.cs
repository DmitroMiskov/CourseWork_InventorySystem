using Inventory.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Inventory.Application.Common.Interfaces;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;

namespace Inventory.Infrastructure.Persistence
{
    public partial class ApplicationDbContext : IdentityDbContext<IdentityUser>, IApplicationDbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Product> Products { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<StockMovement> StockMovements => Set<StockMovement>();
        public DbSet<Supplier> Suppliers { get; set; }
        public DbSet<Customer> Customers { get; set; }
        public DbSet<ProductHistory> ProductHistories { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<InventoryAudit> InventoryAudits { get; set; }
        public DbSet<InventoryAuditItem> InventoryAuditItems { get; set; }
        public DbSet<PurchaseOrder> PurchaseOrders { get; set; }
        public DbSet<PurchaseOrderItem> PurchaseOrderItems { get; set; }
        public DbSet<Warehouse> Warehouses { get; set; }
        public DbSet<WarehouseStock> WarehouseStocks { get; set; }
        public DbSet<WarehouseTransfer> WarehouseTransfers { get; set; }
        public DbSet<WarehouseTransferItem> WarehouseTransferItems { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<Product>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.SKU).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Unit).IsRequired().HasMaxLength(20);
                entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
                entity.Property(e => e.MinStock).HasDefaultValue(0);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
                entity.HasOne(e => e.Category)
                      .WithMany(c => c.Products)
                      .HasForeignKey(e => e.CategoryId)
                      .OnDelete(DeleteBehavior.Restrict);
            });
            modelBuilder.Entity<Category>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(50);
            });
            modelBuilder.Entity<AuditLog>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.UserName).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Action).IsRequired().HasMaxLength(50);
                entity.Property(e => e.EntityType).IsRequired().HasMaxLength(50);
                entity.HasIndex(e => e.Timestamp);
                entity.HasIndex(e => e.UserName);
                entity.HasIndex(e => e.Action);
                entity.HasIndex(e => e.EntityType);
            });
            modelBuilder.Entity<InventoryAudit>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.AuditNumber).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Title).IsRequired().HasMaxLength(150);
                entity.Property(e => e.CreatedByUserName).IsRequired().HasMaxLength(100);
                entity.Property(e => e.TotalSurplusCost).HasColumnType("decimal(18,2)");
                entity.Property(e => e.TotalDeficitCost).HasColumnType("decimal(18,2)");
                entity.HasIndex(e => e.AuditNumber).IsUnique();
                entity.HasIndex(e => e.CreatedAt);
                entity.HasIndex(e => e.Status);
                entity.HasMany(e => e.Items)
                      .WithOne(i => i.InventoryAudit)
                      .HasForeignKey(i => i.InventoryAuditId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
            modelBuilder.Entity<InventoryAuditItem>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.UnitPrice).HasColumnType("decimal(18,2)");
                entity.Property(e => e.DiscrepancyCost).HasColumnType("decimal(18,2)");
                entity.HasOne(e => e.Product)
                      .WithMany()
                      .HasForeignKey(e => e.ProductId)
                      .OnDelete(DeleteBehavior.Restrict);
            });
            modelBuilder.Entity<PurchaseOrder>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.OrderNumber).IsRequired().HasMaxLength(50);
                entity.Property(e => e.Title).IsRequired().HasMaxLength(150);
                entity.Property(e => e.CreatedByUserName).IsRequired().HasMaxLength(100);
                entity.Property(e => e.ApprovedByUserName).HasMaxLength(100);
                entity.Property(e => e.TotalAmount).HasColumnType("decimal(18,2)");
                entity.HasIndex(e => e.OrderNumber).IsUnique();
                entity.HasIndex(e => e.CreatedAt);
                entity.HasIndex(e => e.Status);
                entity.HasOne(e => e.Supplier)
                      .WithMany()
                      .HasForeignKey(e => e.SupplierId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasMany(e => e.Items)
                      .WithOne(i => i.PurchaseOrder)
                      .HasForeignKey(i => i.PurchaseOrderId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
            modelBuilder.Entity<PurchaseOrderItem>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.UnitPrice).HasColumnType("decimal(18,2)");
                entity.Property(e => e.TotalCost).HasColumnType("decimal(18,2)");
                entity.HasOne(e => e.Product)
                      .WithMany()
                      .HasForeignKey(e => e.ProductId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            // Мультискладський облік
            modelBuilder.Entity<Warehouse>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Code).IsRequired().HasMaxLength(50);
                entity.HasIndex(e => e.Code).IsUnique();
                entity.HasIndex(e => e.IsActive);
            });

            modelBuilder.Entity<WarehouseStock>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => new { e.WarehouseId, e.ProductId }).IsUnique();
                entity.HasOne(e => e.Warehouse)
                      .WithMany(w => w.Stocks)
                      .HasForeignKey(e => e.WarehouseId)
                      .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(e => e.Product)
                      .WithMany()
                      .HasForeignKey(e => e.ProductId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<WarehouseTransfer>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.TransferNumber).IsRequired().HasMaxLength(50);
                entity.Property(e => e.CreatedByUserName).IsRequired().HasMaxLength(100);
                entity.HasIndex(e => e.TransferNumber).IsUnique();
                entity.HasIndex(e => e.CreatedAt);
                entity.HasIndex(e => e.Status);
                entity.HasOne(e => e.FromWarehouse)
                      .WithMany()
                      .HasForeignKey(e => e.FromWarehouseId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(e => e.ToWarehouse)
                      .WithMany()
                      .HasForeignKey(e => e.ToWarehouseId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasMany(e => e.Items)
                      .WithOne(i => i.WarehouseTransfer)
                      .HasForeignKey(i => i.WarehouseTransferId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<WarehouseTransferItem>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasOne(e => e.Product)
                      .WithMany()
                      .HasForeignKey(e => e.ProductId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<StockMovement>(entity =>
            {
                entity.HasOne(e => e.Warehouse)
                      .WithMany()
                      .HasForeignKey(e => e.WarehouseId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(e => e.ToWarehouse)
                      .WithMany()
                      .HasForeignKey(e => e.ToWarehouseId)
                      .OnDelete(DeleteBehavior.Restrict);
            });
        }
    }
}
