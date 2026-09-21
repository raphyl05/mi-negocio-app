using Microsoft.EntityFrameworkCore;
using Vendelo.Api.Common;
using Vendelo.Api.Data;

namespace Vendelo.Api.Endpoints;

public static class CatalogEndpoints
{
    public static void MapCatalogEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/v1/businesses/{businessId}");

        g.MapGet("/products", ListProductsAsync).RequireAuthorization();
        g.MapPost("/products", CreateProductAsync).RequireAuthorization();
        g.MapPut("/products/{productId}", UpdateProductAsync).RequireAuthorization();
        g.MapDelete("/products/{productId}", DeleteProductAsync).RequireAuthorization();

        g.MapGet("/customers", ListCustomersAsync).RequireAuthorization();
        g.MapPost("/customers", CreateCustomerAsync).RequireAuthorization();
        g.MapPut("/customers/{customerId}", UpdateCustomerAsync).RequireAuthorization();
        g.MapDelete("/customers/{customerId}", DeleteCustomerAsync).RequireAuthorization();

        g.MapGet("/providers", ListProvidersAsync).RequireAuthorization();
        g.MapPost("/providers", CreateProviderAsync).RequireAuthorization();
        g.MapPut("/providers/{providerId}", UpdateProviderAsync).RequireAuthorization();
        g.MapDelete("/providers/{providerId}", DeleteProviderAsync).RequireAuthorization();
    }

    private static async Task<EffectiveAccess> AccessAsync(string businessId, HttpContext http, AccessService access, string? permission, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != businessId) throw AppException.NotFound("negocio");
        if (permission is not null) AccessService.Require(a, permission);
        return a;
    }

    #region Products
    private static async Task<IResult> ListProductsAsync(string businessId, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        await AccessAsync(businessId, http, access, null, ct);
        var list = await db.Products.AsNoTracking().Where(x => x.BusinessId == businessId).OrderBy(x => x.UpdatedAt).ThenBy(x => x.Id).ToListAsync(ct);
        return Results.Ok(list.Select(ProductDto.From));
    }

    private static async Task<IResult> CreateProductAsync(string businessId, ProductRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await AccessAsync(businessId, http, access, "products.crud", ct);
        if (string.IsNullOrWhiteSpace(req.Name)) throw new AppException("VALIDATION_ERROR", "name es obligatorio.", 400);
        if (req.PriceCents < 0) throw new AppException("VALIDATION_ERROR", "priceCents inválido.", 400);

        var now = DateTimeOffset.UtcNow;
        var p = new Product
        {
            Id = GenId.NewId(req.Id, "product"),
            BusinessId = businessId,
            Name = req.Name.Trim(),
            PriceCents = req.PriceCents,
            OpeningStock = req.OpeningStock ?? 0,
            Active = req.Active ?? true,
            Seq = await db.NextSeqAsync(businessId, ct),
            CreatedAt = now,
            UpdatedAt = now
        };
        if (await db.Products.AnyAsync(x => x.Id == p.Id && x.BusinessId == businessId, ct))
            throw new AppException("CONFLICT", "El producto ya existe.", 409);
        db.Products.Add(p);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/v1/businesses/{businessId}/products/{p.Id}", ProductDto.From(p));
    }

    private static async Task<IResult> UpdateProductAsync(string businessId, string productId, ProductRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        await AccessAsync(businessId, http, access, "products.crud", ct);
        var p = await db.Products.FirstOrDefaultAsync(x => x.Id == productId && x.BusinessId == businessId, ct) ?? throw AppException.NotFound("producto");
        if (!string.IsNullOrWhiteSpace(req.Name)) p.Name = req.Name.Trim();
        if (req.PriceCents >= 0) p.PriceCents = req.PriceCents;
        if (req.Active is not null) p.Active = req.Active.Value;
        p.Seq = await db.NextSeqAsync(businessId, ct);
        p.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Results.Ok(ProductDto.From(p));
    }

    private static async Task<IResult> DeleteProductAsync(string businessId, string productId, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await AccessAsync(businessId, http, access, "products.crud", ct);
        var p = await db.Products.FirstOrDefaultAsync(x => x.Id == productId && x.BusinessId == businessId, ct) ?? throw AppException.NotFound("producto");
        p.Deleted = true;
        p.Seq = await db.NextSeqAsync(businessId, ct);
        p.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { deleted = true, id = p.Id });
    }
    #endregion

    #region Customers / Providers (CRUD compartido)
    private static async Task<IResult> ListCustomersAsync(string businessId, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        await AccessAsync(businessId, http, access, null, ct);
        var list = await db.Customers.AsNoTracking().Where(x => x.BusinessId == businessId).OrderBy(x => x.UpdatedAt).ThenBy(x => x.Id).ToListAsync(ct);
        return Results.Ok(list.Select(NamedEntityDto.From));
    }

    private static async Task<IResult> ListProvidersAsync(string businessId, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        await AccessAsync(businessId, http, access, null, ct);
        var list = await db.Providers.AsNoTracking().Where(x => x.BusinessId == businessId).OrderBy(x => x.UpdatedAt).ThenBy(x => x.Id).ToListAsync(ct);
        return Results.Ok(list.Select(NamedEntityDto.From));
    }

    private static async Task<IResult> CreateCustomerAsync(string businessId, NamedEntityRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
        => await CreateNamedAsync(businessId, req, http, db, access, "customer", ct);

    private static async Task<IResult> UpdateCustomerAsync(string businessId, string customerId, NamedEntityRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
        => await UpdateNamedAsync(businessId, customerId, req, http, db, access,
            async q => (SyncRow?)await q.Customers.FirstOrDefaultAsync(x => x.Id == customerId && x.BusinessId == businessId, ct), "customer", ct);

    private static async Task<IResult> DeleteCustomerAsync(string businessId, string customerId, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
        => await DeleteNamedAsync(businessId, customerId, http, db, access,
            async q => (SyncRow?)await q.Customers.FirstOrDefaultAsync(x => x.Id == customerId && x.BusinessId == businessId, ct), "customer", ct);

    private static async Task<IResult> CreateProviderAsync(string businessId, NamedEntityRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
        => await CreateNamedAsync(businessId, req, http, db, access, "provider", ct);

    private static async Task<IResult> UpdateProviderAsync(string businessId, string providerId, NamedEntityRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
        => await UpdateNamedAsync(businessId, providerId, req, http, db, access,
            async q => (SyncRow?)await q.Providers.FirstOrDefaultAsync(x => x.Id == providerId && x.BusinessId == businessId, ct), "provider", ct);

    private static async Task<IResult> DeleteProviderAsync(string businessId, string providerId, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
        => await DeleteNamedAsync(businessId, providerId, http, db, access,
            async q => (SyncRow?)await q.Providers.FirstOrDefaultAsync(x => x.Id == providerId && x.BusinessId == businessId, ct), "provider", ct);

    private static async Task<IResult> CreateNamedAsync(
        string businessId, NamedEntityRequestDto req, HttpContext http, VendeloDbContext db,
        AccessService access, string kind, CancellationToken ct)
    {
        var a = await AccessAsync(businessId, http, access, "products.crud", ct);
        if (string.IsNullOrWhiteSpace(req.Name)) throw new AppException("VALIDATION_ERROR", "name es obligatorio.", 400);
        var now = DateTimeOffset.UtcNow;
        var id = GenId.NewId(req.Id, kind);
        var seq = await db.NextSeqAsync(businessId, ct);

        if (kind == "customer")
        {
            var c = new Customer { Id = id, Name = req.Name.Trim(), Phone = req.Phone, Address = req.Address, Description = req.Description, Seq = seq, CreatedAt = now, UpdatedAt = now };
            db.Customers.Add(c);
            await SaveNamedAsync(db, businessId, id, ct);
            return Results.Created($"/api/v1/businesses/{businessId}/customers/{id}", NamedEntityDto.From(c));
        }
        var p = new Provider { Id = id, Name = req.Name.Trim(), Phone = req.Phone, Address = req.Address, Description = req.Description, Seq = seq, CreatedAt = now, UpdatedAt = now };
        db.Providers.Add(p);
        await SaveNamedAsync(db, businessId, id, ct);
        return Results.Created($"/api/v1/businesses/{businessId}/providers/{id}", NamedEntityDto.From(p));
    }

    private static async Task<IResult> UpdateNamedAsync(
        string businessId, string id, NamedEntityRequestDto req, HttpContext http, VendeloDbContext db,
        AccessService access, Func<VendeloDbContext, Task<SyncRow?>> finder, string kind, CancellationToken ct)
    {
        await AccessAsync(businessId, http, access, "products.crud", ct);
        var row = await finder(db) ?? throw AppException.NotFound(kind);
        if (row is Customer c)
        {
            ApplyNamed(c, req);
            c.Seq = await db.NextSeqAsync(businessId, ct);
            c.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.Ok(NamedEntityDto.From(c));
        }
        if (row is Provider pr)
        {
            ApplyNamed(pr, req);
            pr.Seq = await db.NextSeqAsync(businessId, ct);
            pr.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.Ok(NamedEntityDto.From(pr));
        }
        throw new InvalidOperationException();
    }

    private static async Task<IResult> DeleteNamedAsync(
        string businessId, string id, HttpContext http, VendeloDbContext db,
        AccessService access, Func<VendeloDbContext, Task<SyncRow?>> finder, string kind, CancellationToken ct)
    {
        await AccessAsync(businessId, http, access, "products.crud", ct);
        var row = await finder(db) ?? throw AppException.NotFound(kind);
        var seq = await db.NextSeqAsync(businessId, ct);
        if (row is Customer c) { c.Deleted = true; c.Seq = seq; c.UpdatedAt = DateTimeOffset.UtcNow; }
        if (row is Provider p) { p.Deleted = true; p.Seq = seq; p.UpdatedAt = DateTimeOffset.UtcNow; }
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { deleted = true, id });
    }

    private static void ApplyNamed(Customer c, NamedEntityRequestDto req)
    {
        if (!string.IsNullOrWhiteSpace(req.Name)) c.Name = req.Name.Trim();
        if (req.Phone is not null) c.Phone = req.Phone;
        if (req.Address is not null) c.Address = req.Address;
        if (req.Description is not null) c.Description = req.Description;
    }

    private static void ApplyNamed(Provider p, NamedEntityRequestDto req)
    {
        if (!string.IsNullOrWhiteSpace(req.Name)) p.Name = req.Name.Trim();
        if (req.Phone is not null) p.Phone = req.Phone;
        if (req.Address is not null) p.Address = req.Address;
        if (req.Description is not null) p.Description = req.Description;
    }

    private static async Task SaveNamedAsync(VendeloDbContext db, string businessId, string id, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            db.ChangeTracker.Clear();
            throw new AppException("CONFLICT", "Ya existe un registro con ese id.", 409);
        }
    }
    #endregion
}
