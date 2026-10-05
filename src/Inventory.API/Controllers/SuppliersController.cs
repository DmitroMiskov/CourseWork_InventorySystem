using Inventory.API.Dtos;
using Inventory.Application.Common.Interfaces;
using Inventory.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inventory.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class SuppliersController : ControllerBase
    {
        private readonly IApplicationDbContext _context;

        public SuppliersController(IApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetSuppliers()
        {
            var suppliers = await _context.Suppliers
                .AsNoTracking()
                .OrderBy(s => s.Name)
                .Select(s => new
                {
                    s.Id,
                    s.Name,
                    s.ContactPerson,
                    s.Phone,
                    s.Email,
                    s.Edrpou,
                    s.Address,
                    s.LeadTimeDays,
                    s.ContractNumber,
                    s.PaymentTerms,
                    ContactInfo = !string.IsNullOrEmpty(s.ContactPerson)
                        ? (s.ContactPerson + (!string.IsNullOrEmpty(s.Phone) ? $" ({s.Phone})" : ""))
                        : (!string.IsNullOrEmpty(s.Phone) ? s.Phone : s.Email)
                })
                .ToListAsync();

            return Ok(suppliers);
        }

        [HttpPost]
        [Authorize(Roles = "Admin, admin, Manager, manager")]
        public async Task<IActionResult> CreateSupplier([FromBody] PartnerDto dto)
        {
            var supplier = new Supplier
            {
                Id = Guid.NewGuid(),
                Name = dto.Name.Trim(),
                ContactPerson = dto.ContactPerson?.Trim() ?? dto.ContactInfo?.Trim() ?? string.Empty,
                Phone = dto.Phone?.Trim() ?? string.Empty,
                Email = dto.Email?.Trim() ?? string.Empty,
                Edrpou = dto.Edrpou?.Trim() ?? string.Empty,
                Address = dto.Address?.Trim() ?? string.Empty,
                LeadTimeDays = dto.LeadTimeDays.HasValue && dto.LeadTimeDays.Value > 0 ? dto.LeadTimeDays.Value : 5,
                ContractNumber = dto.ContractNumber?.Trim() ?? string.Empty,
                PaymentTerms = dto.PaymentTerms?.Trim() ?? string.Empty
            };

            _context.Suppliers.Add(supplier);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                id = supplier.Id,
                name = supplier.Name,
                contactPerson = supplier.ContactPerson,
                phone = supplier.Phone,
                email = supplier.Email,
                edrpou = supplier.Edrpou,
                address = supplier.Address,
                leadTimeDays = supplier.LeadTimeDays,
                contractNumber = supplier.ContractNumber,
                paymentTerms = supplier.PaymentTerms
            });
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin, admin, Manager, manager")]
        public async Task<IActionResult> UpdateSupplier(Guid id, [FromBody] PartnerDto dto)
        {
            var supplier = await _context.Suppliers.FindAsync(id);
            if (supplier == null) return NotFound("Постачальника не знайдено");

            supplier.Name = dto.Name.Trim();
            if (dto.ContactPerson != null) supplier.ContactPerson = dto.ContactPerson.Trim();
            else if (dto.ContactInfo != null) supplier.ContactPerson = dto.ContactInfo.Trim();

            if (dto.Phone != null) supplier.Phone = dto.Phone.Trim();
            if (dto.Email != null) supplier.Email = dto.Email.Trim();
            if (dto.Edrpou != null) supplier.Edrpou = dto.Edrpou.Trim();
            if (dto.Address != null) supplier.Address = dto.Address.Trim();
            if (dto.LeadTimeDays.HasValue && dto.LeadTimeDays.Value > 0) supplier.LeadTimeDays = dto.LeadTimeDays.Value;
            if (dto.ContractNumber != null) supplier.ContractNumber = dto.ContractNumber.Trim();
            if (dto.PaymentTerms != null) supplier.PaymentTerms = dto.PaymentTerms.Trim();

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin, admin")]
        public async Task<IActionResult> DeleteSupplier(Guid id)
        {
            var supplier = await _context.Suppliers.FindAsync(id);
            if (supplier == null) return NotFound("Постачальника не знайдено");

            _context.Suppliers.Remove(supplier);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}