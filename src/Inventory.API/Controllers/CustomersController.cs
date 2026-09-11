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
    public class CustomersController : ControllerBase
    {
        private readonly IApplicationDbContext _context;

        public CustomersController(IApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetCustomers()
        {
            var customers = await _context.Customers.ToListAsync();
            var result = customers.Select(c => new
            {
                c.Id,
                c.Name,
                ContactInfo = !string.IsNullOrEmpty(c.Phone) ? c.Phone : (!string.IsNullOrEmpty(c.Email) ? c.Email : c.Address),
                c.Phone,
                c.Email,
                c.Address
            });
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateCustomer([FromBody] PartnerDto dto)
        {
            var customer = new Customer
            {
                Id = Guid.NewGuid(),
                Name = dto.Name,
                Phone = dto.ContactInfo ?? string.Empty
            };

            _context.Customers.Add(customer);
            await _context.SaveChangesAsync();

            return Ok(new { id = customer.Id, name = customer.Name, contactInfo = customer.Phone });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCustomer(Guid id, [FromBody] PartnerDto dto)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound("Клієнта не знайдено");

            customer.Name = dto.Name;
            if (dto.ContactInfo != null)
            {
                customer.Phone = dto.ContactInfo;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCustomer(Guid id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound("Клієнта не знайдено");

            _context.Customers.Remove(customer);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}