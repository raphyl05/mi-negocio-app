using Microsoft.EntityFrameworkCore;
using Vendelo.Api.Common;
using Vendelo.Api.Data;

namespace Vendelo.Api.Endpoints;

public static class BusinessEndpoints
{
    public static void MapBusinessEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/v1");

        g.MapGet("/businesses", ListAsync).RequireAuthorization();
        g.MapPost("/businesses", CreateAsync).RequireAuthorization();
        g.MapGet("/businesses/{id}", GetAsync).RequireAuthorization();
        g.MapPatch("/businesses/{id}", PatchAsync).RequireAuthorization();
        g.MapGet("/businesses/{id}/capabilities", GetCapabilitiesAsync).RequireAuthorization();
        g.MapPatch("/businesses/{id}/capabilities", PatchCapabilitiesAsync).RequireAuthorization();
        g.MapGet("/businesses/{id}/devices", ListDevicesAsync).RequireAuthorization();
        g.MapPost("/devices", RegisterDeviceAsync).RequireAuthorization();
        g.MapPatch("/businesses/{id}/devices/{deviceId}/revoke", RevokeDeviceAsync).RequireAuthorization();
        g.MapGet("/businesses/{id}/backups", ListBackupsAsync).RequireAuthorization();
        g.MapPost("/businesses/{id}/backups", CreateBackupAsync).RequireAuthorization();
        g.MapDelete("/businesses/{id}/backups/{backupId}", DeleteBackupAsync).RequireAuthorization();
        g.MapPost("/businesses/{id}/backups/{backupId}/restore", RestoreBackupAsync).RequireAuthorization();
        g.MapPut("/businesses/{id}/backups/self", UploadSelfBackupAsync).RequireAuthorization();
        g.MapGet("/businesses/{id}/backups/self/latest", DownloadSelfBackupAsync).RequireAuthorization();

        g.MapGet("/health", HealthAsync);
    }

    private static async Task<IResult> ListAsync(HttpContext http, VendeloDbContext db, CancellationToken ct)
    {
        var userId = http.User.UserIdOf();
        var ms = await db.Memberships.AsNoTracking().Where(x => x.UserId == userId && x.Active).ToListAsync(ct);
        var ids = ms.Select(m => m.BusinessId).ToList();
        var bizs = await db.Businesses.AsNoTracking().Where(x => ids.Contains(x.Id)).ToListAsync(ct);
        return Results.Ok(ms.Join(bizs, m => m.BusinessId, b => b.Id, (m, b) => BusinessLiteDto.From(b, m.Role)).ToList());
    }

    private static async Task<IResult> CreateAsync(
        HttpContext http, CreateBusinessRequestDto req, VendeloDbContext db, CancellationToken ct)
    {
        var userId = http.User.UserIdOf();
        if (string.IsNullOrWhiteSpace(req.Name))
            throw new AppException("VALIDATION_ERROR", "name es obligatorio.", 400);

        var now = DateTimeOffset.UtcNow;
        var businessId = GenId.NewId(req.BusinessId, "business");
        if (await db.Businesses.AnyAsync(x => x.Id == businessId, ct))
            throw new AppException("CONFLICT", "El businessId ya existe.", 409);

        var b = new Business
        {
            Id = businessId,
            Name = req.Name,
            OwnerName = req.OwnerName,
            BusinessType = req.BusinessType ?? "COMMERCE",
            CapabilitiesJson = Json.Ser(req.Capabilities ?? new Dictionary<string, object?>()),
            SettingsJson = Json.Ser(req.Settings ?? new Dictionary<string, object?>()),
            CapabilityVersion = 1,
            NextOrderNumber = 1,
            CreatedAt = now,
            UpdatedAt = now
        };
        var m = new Membership
        {
            Id = GenId.MembershipId(),
            UserId = userId!,
            BusinessId = businessId,
            Role = Roles.Owner,
            Active = true,
            CreatedAt = now
        };
        db.Businesses.Add(b);
        db.Memberships.Add(m);
        db.Sequences.Add(new OrganizationSequence { BusinessId = businessId, NextSeq = 1 });
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/v1/businesses/{businessId}", new CreateBusinessResponseDto
        {
            Business = BusinessDto.From(b),
            Membership = new MembershipDto { Id = m.Id, BusinessId = m.BusinessId, UserId = m.UserId, Role = m.Role }
        });
    }

    private static async Task<IResult> GetAsync(string id, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != id) throw AppException.NotFound("negocio");
        return Results.Ok(BusinessDto.From(a.Business));
    }

    private static async Task<IResult> PatchAsync(
        string id, PatchBusinessRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != id) throw AppException.NotFound("negocio");
        AccessService.Require(a, "capabilities");

        var b = await db.Businesses.FirstAsync(x => x.Id == id, ct);
        bool changed = false;
        if (!string.IsNullOrWhiteSpace(req.Name)) { b.Name = req.Name; changed = true; }
        if (req.OwnerName is not null) { b.OwnerName = req.OwnerName; changed = true; }
        if (req.BusinessType is not null)
        {
            if (!ValidBusinessTypes.Contains(req.BusinessType)) throw new AppException("VALIDATION_ERROR", "businessType inválido.", 400);
            b.BusinessType = req.BusinessType;
            changed = true;
        }
        if (req.Settings is not null) { b.SettingsJson = Json.Ser(req.Settings); changed = true; }
        if (changed)
        {
            b.CapabilityVersion++;
            b.UpdatedAt = DateTimeOffset.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        return Results.Ok(BusinessDto.From(b));
    }

    private static async Task<IResult> GetCapabilitiesAsync(string id, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != id) throw AppException.NotFound("negocio");
        return Results.Ok(BusinessDto.From(a.Business));
    }

    private static async Task<IResult> PatchCapabilitiesAsync(
        string id, PatchCapabilitiesRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != id) throw AppException.NotFound("negocio");
        AccessService.Require(a, "capabilities");

        var b = await db.Businesses.AsTracking().FirstAsync(x => x.Id == id, ct);
        if (req.ExpectedCapabilityVersion is null || req.ExpectedCapabilityVersion != b.CapabilityVersion)
            throw new AppException("VERSION_MISMATCH",
                "La configuración cambió; recarga y reintenta.", 409,
                new { current = b.CapabilityVersion, expected = req.ExpectedCapabilityVersion });

        var caps = req.Capabilities is null ? b.Capabilities : NormalizeCapabilities(req.Capabilities, !b.Capabilities.TryGetValue("kitchenPrinting", out var p) || p is not bool pb || pb);
        if (req.Capabilities is null && !b.Capabilities.ContainsKey("restaurant"))
            caps = MergeDefaults(caps);

        b.BusinessType = req.BusinessType ?? b.BusinessType;
        b.CapabilitiesJson = Json.Ser(caps);
        b.SettingsJson = Json.Ser(req.Settings ?? b.Settings);
        b.CapabilityVersion++;
        b.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Results.Ok(BusinessDto.From(b));
    }

    private static async Task<IResult> ListDevicesAsync(string id, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != id) throw AppException.NotFound("negocio");
        var list = await db.Devices.AsNoTracking().Where(x => x.BusinessId == id).OrderBy(x => x.RegisteredAt).ToListAsync(ct);
        return Results.Ok(list.Select(d => new { d.Id, d.Name, d.Role, d.Active, RegisteredAt = d.RegisteredAt.ToString("O") }));
    }

    private static async Task<IResult> RegisterDeviceAsync(
        RegisterDeviceRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        AccessService.Require(a, "members.devices");
        if (string.IsNullOrWhiteSpace(req.BusinessId) || req.BusinessId != a.Business.Id)
            throw AppException.NotFound("negocio");
        if (string.IsNullOrWhiteSpace(req.DeviceId) || req.DeviceId.Length > 64)
            throw new AppException("VALIDATION_ERROR", "deviceId obligatorio (≤ 64).", 400);
        if (req.Role is not null && !Roles.All.Contains(req.Role))
            throw new AppException("VALIDATION_ERROR", $"rol inválido. Válidos: {string.Join(", ", Roles.All)}.", 400);
        if (await db.Devices.AnyAsync(x => x.Id == req.DeviceId && x.BusinessId == req.BusinessId, ct))
            throw new AppException("CONFLICT", "Dispositivo ya registrado.", 409);

        var d = new Device
        {
            Id = req.DeviceId,
            BusinessId = req.BusinessId,
            Name = req.DeviceName ?? req.DeviceId,
            Role = req.Role,
            Active = true,
            RegisteredAt = DateTimeOffset.UtcNow
        };
        db.Devices.Add(d);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/v1/devices/{d.Id}", new { d.Id, d.Name, d.Role, d.Active, d.RegisteredAt });
    }

    private static async Task<IResult> RevokeDeviceAsync(
        string id, string deviceId, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != id) throw AppException.NotFound("negocio");
        AccessService.Require(a, "members.devices");
        var d = await db.Devices.FirstOrDefaultAsync(x => x.Id == deviceId && x.BusinessId == id, ct)
            ?? throw AppException.NotFound("dispositivo");
        d.Active = false;
        var sessions = await db.DeviceSessions.Where(x => x.DeviceId == deviceId && x.Active).ToListAsync(ct);
        foreach (var s in sessions) s.Active = false;
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { revoked = true, deviceId });
    }

    private static async Task<IResult> ListBackupsAsync(string id, HttpContext http, VendeloDbContext db, AccessService access, RateLimiter rl, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != id) throw AppException.NotFound("negocio");
        AccessService.Require(a, "backups");
        RateLimiter.Enforce(rl, $"bk:list:b:{id}", 120, RlWindow);
        RateLimiter.Enforce(rl, $"bk:list:ip:{http.Connection.RemoteIpAddress}", 480, RlWindow);
        var list = await db.Backups.AsNoTracking().Where(x => x.BusinessId == id).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Results.Ok(list.Select(x => new { x.Id, x.BusinessId, CreatedAt = x.CreatedAt.ToString("O") }));
    }

    private static async Task<IResult> CreateBackupAsync(string id, HttpContext http, VendeloDbContext db, AccessService access, RateLimiter rl, IConfiguration cfg, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != id) throw AppException.NotFound("negocio");
        AccessService.Require(a, "backups");
        RateLimiter.Enforce(rl, $"bk:create:b:{id}", 12, RlWindow);
        RateLimiter.Enforce(rl, $"bk:create:ip:{http.Connection.RemoteIpAddress}", 60, RlWindow);

        var products = (await db.Products.AsNoTracking().Where(x => x.BusinessId == id).ToListAsync(ct)).Select(ProductDto.From);
        var customers = (await db.Customers.AsNoTracking().Where(x => x.BusinessId == id).ToListAsync(ct)).Select(NamedEntityDto.From);
        var providers = (await db.Providers.AsNoTracking().Where(x => x.BusinessId == id).ToListAsync(ct)).Select(NamedEntityDto.From);
        var orders = (await db.Orders.AsNoTracking().Where(x => x.BusinessId == id).ToListAsync(ct)).Select(OrderDto.From);
        var stock = (await db.StockMovements.AsNoTracking().Where(x => x.BusinessId == id).ToListAsync(ct)).Select(StockMovementDto.From);
        var closures = (await db.CashClosures.AsNoTracking().Where(x => x.BusinessId == id).ToListAsync(ct)).Select(CashClosureDto.From);

        var payload = new
        {
            business = BusinessDto.From(a.Business),
            products, customers, providers, orders, stockMovements = stock, cashClosures = closures
        };
        var backup = new Backup
        {
            Id = GenId.New("backup"),
            BusinessId = id,
            PayloadJson = Cipher.Encrypt(cfg, Json.Ser(payload)),
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Backups.Add(backup);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/v1/businesses/{id}/backups/{backup.Id}",
            new { backup.Id, backup.BusinessId, CreatedAt = backup.CreatedAt.ToString("O") });
    }

    private static async Task<IResult> DeleteBackupAsync(string id, string backupId, HttpContext http, VendeloDbContext db, AccessService access, RateLimiter rl, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != id) throw AppException.NotFound("negocio");
        AccessService.Require(a, "backups");
        RateLimiter.Enforce(rl, $"bk:del:b:{id}", 30, RlWindow);
        var b = await db.Backups.FirstOrDefaultAsync(x => x.Id == backupId && x.BusinessId == id, ct)
            ?? throw AppException.NotFound("backup");
        db.Backups.Remove(b);
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { deleted = true });
    }

    private static async Task<IResult> RestoreBackupAsync(string id, string backupId, HttpContext http, VendeloDbContext db, AccessService access, RateLimiter rl, IConfiguration cfg, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != id) throw AppException.NotFound("negocio");
        AccessService.Require(a, "backups");
        RateLimiter.Enforce(rl, $"bk:restore:b:{id}", 5, RlWindow);
        var b = await db.Backups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == backupId && x.BusinessId == id, ct)
            ?? throw AppException.NotFound("backup");
        var plain = Cipher.TryDecrypt(cfg, b.PayloadJson);
        var json = plain ?? (b.PayloadJson.TrimStart().StartsWith("{") ? b.PayloadJson : null)
            ?? throw new AppException("INTERNAL_ERROR", "Backup corrupto.", 500);
        var payload = Json.Des<BackupPayload>(json) ?? throw new AppException("INTERNAL_ERROR", "Backup corrupto.", 500);
        await DbBackup.RestoreAsync(db, id, payload, ct);
        return Results.Ok(new { restored = true, businessId = id });
    }

    private static async Task<IResult> UploadSelfBackupAsync(
        string id, SelfBackupRequestDto req, HttpContext http, VendeloDbContext db, AccessService access,
        RateLimiter rl, IConfiguration cfg, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != id) throw AppException.NotFound("negocio");
        AccessService.Require(a, "backups");
        RateLimiter.Enforce(rl, $"bk:self:b:{id}", 24, RlWindow);
        RateLimiter.Enforce(rl, $"bk:self:ip:{http.Connection.RemoteIpAddress}", 120, RlWindow);

        var payload = (req.Payload ?? "").Trim();
        if (payload.Length is < 3 or > 4_000_000)
            throw new AppException("VALIDATION_ERROR", "payload inválido (1–4 MB).", 400);
        try
        {
            System.Text.Json.Nodes.JsonNode.Parse(payload);
        }
        catch
        {
            throw new AppException("VALIDATION_ERROR", "payload no es JSON válido.", 400);
        }

        var now = DateTimeOffset.UtcNow;
        var backup = new Backup
        {
            Id = "self-" + Guid.NewGuid().ToString("N"),
            BusinessId = id,
            PayloadJson = Cipher.Encrypt(cfg, payload),
            CreatedAt = now
        };
        db.Backups.Add(backup);

        var self = await db.Backups.AsTracking()
            .Where(x => x.BusinessId == id && x.Id.StartsWith("self-"))
            .OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        foreach (var old in self.Skip(5)) db.Backups.Remove(old);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/v1/businesses/{id}/backups/self", new
        {
            backup.Id, backup.BusinessId, CreatedAt = backup.CreatedAt.ToString("O")
        });
    }

    private static async Task<IResult> DownloadSelfBackupAsync(
        string id, HttpContext http, VendeloDbContext db, AccessService access,
        RateLimiter rl, IConfiguration cfg, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != id) throw AppException.NotFound("negocio");
        AccessService.Require(a, "backups");
        RateLimiter.Enforce(rl, $"bk:latest:b:{id}", 30, RlWindow);

        var latest = await db.Backups.AsNoTracking()
            .Where(x => x.BusinessId == id && x.Id.StartsWith("self-"))
            .OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("respaldo en la nube");
        var plain = Cipher.TryDecrypt(cfg, latest.PayloadJson)
            ?? throw new AppException("INTERNAL_ERROR", "Respaldo corrupto.", 500);
        return Results.Ok(new
        {
            latest.Id,
            CreatedAt = latest.CreatedAt.ToString("O"),
            Payload = System.Text.Json.Nodes.JsonNode.Parse(plain)
        });
    }

    private static async Task<IResult> HealthAsync(VendeloDbContext db, CancellationToken ct)
    {
        try
        {
            await db.Sequences.AsNoTracking().FirstOrDefaultAsync(ct);
        }
        catch
        {
            return Results.Json(new { status = "degraded", serverTime = DateTimeOffset.UtcNow.ToString("O") }, statusCode: 503);
        }
        return Results.Ok(new { status = "ok", serverTime = DateTimeOffset.UtcNow.ToString("O") });
    }

    private static readonly HashSet<string> ValidBusinessTypes =
        ["COMMERCE", "RESTAURANT", "FOOD_TRUCK", "MOBILE_VENDOR", "SERVICE", "OTHER"];

    private static readonly TimeSpan RlWindow = TimeSpan.FromMinutes(1);

    private static readonly string[] CapKeys = ["restaurant", "waiters", "tables", "kitchen", "kitchenPrinting"];

    private static Dictionary<string, object?> NormalizeCapabilities(Dictionary<string, object?> raw, bool keepPrinting)
    {
        var all = new Dictionary<string, object?>();
        foreach (var k in CapKeys) all[k] = raw.TryGetValue(k, out var v) && Json.AsBool(v);
        if (keepPrinting && raw.TryGetValue("kitchenPrinting", out _) is false) all["kitchenPrinting"] = false;
        return all;
    }

    private static Dictionary<string, object?> MergeDefaults(Dictionary<string, object?> input) => input;
}

public sealed class PatchBusinessRequestDto
{
    [System.Text.Json.Serialization.JsonPropertyName("name")] public string? Name { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("ownerName")] public string? OwnerName { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("businessType")] public string? BusinessType { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("settings")] public Dictionary<string, object?>? Settings { get; set; }
}

public sealed class RegisterDeviceRequestDto
{
    [System.Text.Json.Serialization.JsonPropertyName("businessId")] public string? BusinessId { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("deviceId")] public string? DeviceId { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("deviceName")] public string? DeviceName { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("role")] public string? Role { get; set; }
}

public sealed class SelfBackupRequestDto
{
    [System.Text.Json.Serialization.JsonPropertyName("payload")] public string? Payload { get; set; }
}

public sealed class BackupPayload
{
    [System.Text.Json.Serialization.JsonPropertyName("business")] public BusinessDto? Business { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("products")] public List<ProductDto> Products { get; set; } = [];
    [System.Text.Json.Serialization.JsonPropertyName("customers")] public List<NamedEntityDto> Customers { get; set; } = [];
    [System.Text.Json.Serialization.JsonPropertyName("providers")] public List<NamedEntityDto> Providers { get; set; } = [];
    [System.Text.Json.Serialization.JsonPropertyName("orders")] public List<OrderDto> Orders { get; set; } = [];
    [System.Text.Json.Serialization.JsonPropertyName("stockMovements")] public List<StockMovementDto> StockMovements { get; set; } = [];
    [System.Text.Json.Serialization.JsonPropertyName("cashClosures")] public List<CashClosureDto> CashClosures { get; set; } = [];
}

public static class DbBackup
{
    public static async Task RestoreAsync(VendeloDbContext db, string businessId, BackupPayload p, CancellationToken ct)
    {
        db.Products.RemoveRange(db.Products.Where(x => x.BusinessId == businessId));
        db.Customers.RemoveRange(db.Customers.Where(x => x.BusinessId == businessId));
        db.Providers.RemoveRange(db.Providers.Where(x => x.BusinessId == businessId));
        db.Orders.RemoveRange(db.Orders.Where(x => x.BusinessId == businessId));
        db.StockMovements.RemoveRange(db.StockMovements.Where(x => x.BusinessId == businessId));
        db.CashClosures.RemoveRange(db.CashClosures.Where(x => x.BusinessId == businessId));
        db.CashRegisters.RemoveRange(db.CashRegisters.Where(x => x.BusinessId == businessId));
        db.SyncBatches.RemoveRange(db.SyncBatches.Where(x => x.BusinessId == businessId));
        await db.SaveChangesAsync(ct);

        var biz = await db.Businesses.FirstAsync(x => x.Id == businessId, ct);
        var seq = await db.Sequences.AsTracking().FirstAsync(x => x.BusinessId == businessId, ct);

        long maxSeq = 0;
        void Track(long s) { if (s > maxSeq) maxSeq = s; }

        if (p.Products is not null)
            foreach (var d in p.Products)
            {
                Track(d.Seq);
                db.Products.Add(new Product
                {
                    Id = d.Id, BusinessId = businessId, Name = d.Name, PriceCents = d.PriceCents,
                    OpeningStock = d.OpeningStock, Active = d.Active, Deleted = d.Deleted, Seq = d.Seq,
                    CreatedAt = Parse(d.CreatedAt), UpdatedAt = Parse(d.UpdatedAt)
                });
            }
        if (p.Customers is not null)
            foreach (var d in p.Customers)
            {
                Track(d.Seq);
                db.Customers.Add(new Customer
                {
                    Id = d.Id, BusinessId = businessId, Name = d.Name, Phone = d.Phone, Address = d.Address,
                    Description = d.Description, Deleted = d.Deleted, Seq = d.Seq,
                    CreatedAt = Parse(d.CreatedAt), UpdatedAt = Parse(d.UpdatedAt)
                });
            }
        if (p.Providers is not null)
            foreach (var d in p.Providers)
            {
                Track(d.Seq);
                db.Providers.Add(new Provider
                {
                    Id = d.Id, BusinessId = businessId, Name = d.Name, Phone = d.Phone, Address = d.Address,
                    Description = d.Description, Deleted = d.Deleted, Seq = d.Seq,
                    CreatedAt = Parse(d.CreatedAt), UpdatedAt = Parse(d.UpdatedAt)
                });
            }

        if (p.Orders is not null)
            foreach (var d in p.Orders)
            {
                Track(d.Seq);
                db.Orders.Add(new Order
                {
                    Id = d.Id, BusinessId = businessId, Number = d.Number, Status = d.Status,
                    PrepStatus = d.PrepStatus, OrderType = d.OrderType, WaiterId = d.WaiterId,
                    WaiterName = d.WaiterName, TableId = d.TableId, TableName = d.TableName,
                    CustomerId = d.CustomerId, CustomerName = d.CustomerName,
                    CustomerPhone = d.CustomerPhone, CustomerAddress = d.CustomerAddress,
                    CustomerDescription = d.CustomerDescription,
                    ItemsJson = d.Items is null ? "[]" : Vendelo.Api.Data.Json.Ser(d.Items),
                    EventsJson = d.Events is null ? "[]" : Vendelo.Api.Data.Json.Ser(d.Events),
                    TotalCents = d.TotalCents, ReceivedCents = d.ReceivedCents, ChangeCents = d.ChangeCents,
                    PaymentMethod = d.PaymentMethod, Overventa = d.Overventa, Deleted = d.Deleted, Seq = d.Seq,
                    CreatedAt = Parse(d.CreatedAt), PaidAt = d.PaidAt is null ? default : Parse(d.PaidAt),
                    UpdatedAt = Parse(d.UpdatedAt), KitchenTicketId = d.KitchenTicketId
                });
            }
        if (p.StockMovements is not null)
            foreach (var d in p.StockMovements)
            {
                Track(d.Seq);
                db.StockMovements.Add(new StockMovement
                {
                    Id = d.Id, BusinessId = businessId, ProductId = d.ProductId, MovementType = d.MovementType,
                    Quantity = d.Quantity, AmountCents = d.AmountCents, OrderId = d.OrderId, DeviceId = d.DeviceId,
                    Seq = d.Seq, CreatedAt = Parse(d.CreatedAt)
                });
            }
        if (p.CashClosures is not null)
            foreach (var d in p.CashClosures)
            {
                Track(d.Seq);
                db.CashClosures.Add(new CashClosure
                {
                    Id = d.Id, BusinessId = businessId, RegisterId = d.RegisterId,
                    OpeningAmountCents = d.OpeningAmountCents, ExpectedCents = d.ExpectedCents,
                    ClosingAmountCents = d.ClosingAmountCents, DifferenceCents = d.DifferenceCents,
                    SalesByMethodJson = Vendelo.Api.Data.Json.Ser(d.SalesByMethod ?? new { }),
                    Overventa = d.Overventa, Seq = d.Seq, OpenedAt = Parse(d.OpenedAt), ClosedAt = Parse(d.ClosedAt)
                });
            }

        seq.NextSeq = Math.Max(seq.NextSeq, maxSeq + 1);
        if (p.Business is not null)
        {
            biz.Name = p.Business.Name;
            biz.OwnerName = p.Business.OwnerName;
            if (p.Business.BusinessType is not null) biz.BusinessType = p.Business.BusinessType;
            biz.CapabilityVersion = Math.Max(biz.CapabilityVersion, p.Business.CapabilityVersion);
        }
        await db.SaveChangesAsync(ct);
    }

    public static DateTimeOffset Parse(string s) =>
        DateTimeOffset.TryParse(s, out var v) ? v : DateTimeOffset.UtcNow;
}
