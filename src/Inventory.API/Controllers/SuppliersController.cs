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
            var suppliers = await _context.Suppliers.ToListAsync();
            var result = suppliers.Select(s => new
            {
                s.Id,
                s.Name,
                ContactInfo = !string.IsNullOrEmpty(s.ContactPerson) ? s.ContactPerson : (!string.IsNullOrEmpty(s.Phone) ? s.Phone : s.Email),
                s.ContactPerson,
                s.Phone,
                s.Email
            });
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateSupplier([FromBody] PartnerDto dto)
        {
            var supplier = new Supplier
            {
                Id = Guid.NewGuid(),
                Name = dto.Name,
                ContactPerson = dto.ContactInfo ?? string.Empty
            };

            _context.Suppliers.Add(supplier);
            await _context.SaveChangesAsync();

            return Ok(new { id = supplier.Id, name = supplier.Name, contactInfo = supplier.ContactPerson });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateSupplier(Guid id, [FromBody] PartnerDto dto)
        {
            var supplier = await _context.Suppliers.FindAsync(id);
            if (supplier == null) return NotFound("Постачальника не знайдено");

            supplier.Name = dto.Name;
            if (dto.ContactInfo != null)
            {
                supplier.ContactPerson = dto.ContactInfo;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
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