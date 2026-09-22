using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Vendelo.Api.Common;
using Vendelo.Api.Data;

namespace Vendelo.Api.Endpoints;

public static class SyncEndpoints
{
    private static readonly HashSet<string> EntityTypes =
        ["business", "product", "customer", "provider", "order", "stockMovement", "cashClosure"];
    private static readonly HashSet<string> AppendOnly = ["stockMovement", "cashClosure"];

    public static void MapSyncEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/v1/businesses/{businessId}/sync");
        g.MapGet("/pull", PullAsync).RequireAuthorization();
        g.MapPost("/push", PushAsync).RequireAuthorization();
    }

    private static async Task<EffectiveAccess> AccessAsync(string businessId, HttpContext http, AccessService access, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != businessId) throw AppException.NotFound("negocio");
        return a;
    }

    private static async Task<IResult> PullAsync(
        string businessId, string? since, HttpContext http, VendeloDbContext db, AccessService access,
        RateLimiter rl, CancellationToken ct)
    {
        await AccessAsync(businessId, http, access, ct);
        RateLimiter.Enforce(rl, $"sync:pull:b:{businessId}", 600, RlWindow);
        RateLimiter.Enforce(rl, $"sync:pull:ip:{http.Connection.RemoteIpAddress}", 1200, RlWindow);
        await db.EnsureSeqAsync(businessId, ct);

        long after = ParseSeq(since, out var isSnapshot);
        var changes = new SyncChangesDto();
        long maxSeq = isSnapshot ? long.MaxValue : await CurrentSeqAsync(db, businessId, ct);

        var prod = db.Products.AsNoTracking().Where(x => x.BusinessId == businessId);
        var cust = db.Customers.AsNoTracking().Where(x => x.BusinessId == businessId);
        var prov = db.Providers.AsNoTracking().Where(x => x.BusinessId == businessId);
        var ord = db.Orders.AsNoTracking().Where(x => x.BusinessId == businessId);
        var smv = db.StockMovements.AsNoTracking().Where(x => x.BusinessId == businessId);
        var cls = db.CashClosures.AsNoTracking().Where(x => x.BusinessId == businessId);

        if (!isSnapshot)
        {
            prod = prod.Where(x => x.Seq > after);
            cust = cust.Where(x => x.Seq > after);
            prov = prov.Where(x => x.Seq > after);
            ord = ord.Where(x => x.Seq > after);
            smv = smv.Where(x => x.Seq > after);
            cls = cls.Where(x => x.Seq > after);
        }
        else
        {
            // Snapshot completo MODO A (since=null): incluir tombstones para reconstruir en el cliente.
        }

        changes.Products = (await prod.ToListAsync(ct)).Select(ProductDto.From).ToList();
        changes.Customers = (await cust.ToListAsync(ct)).Select(NamedEntityDto.From).ToList();
        changes.Providers = (await prov.ToListAsync(ct)).Select(NamedEntityDto.From).ToList();
        changes.Orders = (await ord.ToListAsync(ct)).Select(OrderDto.From).ToList();
        changes.StockMovements = (await smv.ToListAsync(ct)).Select(StockMovementDto.From).ToList();
        changes.CashClosures = (await cls.ToListAsync(ct)).Select(CashClosureDto.From).ToList();

        var business = await db.Businesses.AsNoTracking().FirstAsync(x => x.Id == businessId, ct);
        changes.Business = BusinessDto.From(business);

        var cursor = await CurrentSeqAsync(db, businessId, ct);
        return Results.Ok(new PullResponseDto
        {
            Cursor = SeqCursor(cursor),
            NextCursor = null,
            HasMore = false,
            ServerTime = DateTimeOffset.UtcNow.ToString("O"),
            Changes = changes
        });
    }

    private static async Task<IResult> PushAsync(
        string businessId, PushRequestDto req, HttpContext http, VendeloDbContext db, AccessService access,
        RateLimiter rl, CancellationToken ct)
    {
        await AccessAsync(businessId, http, access, ct);
        RateLimiter.Enforce(rl, $"sync:push:b:{businessId}", 120, RlWindow);
        RateLimiter.Enforce(rl, $"sync:push:ip:{http.Connection.RemoteIpAddress}", 480, RlWindow);
        req.RequestId = (req.RequestId ?? "").Trim();
        if (req.RequestId.Length is < 8 or > 64)
            throw new AppException("VALIDATION_ERROR", "requestId obligatorio (8–64).", 400);
        if (req.OpType is not ("initial" or "incremental"))
            throw new AppException("VALIDATION_ERROR", "opType debe ser initial o incremental.", 400);

        var duplicate = await db.SyncBatches.AsNoTracking()
            .FirstOrDefaultAsync(x => x.BusinessId == businessId && x.RequestId == req.RequestId, ct);
        if (duplicate is not null)
        {
            var prev = Json.Des<PushResponseDto>(duplicate.ResponseJson) ?? new PushResponseDto();
            return Results.Ok(new PushResponseDto
            {
                RequestId = req.RequestId, Applied = true, Duplicate = true,
                Seq = prev.Seq, Accepted = prev.Accepted, Rejected = prev.Rejected
            });
        }

        if (req.OpType == "initial" && await db.BusinessHasDataAsync(businessId, ct))
            throw new AppException("CONFLICT",
                "El negocio ya tiene datos en el servidor; usa operaciones incrementales (No se permite opType='initial').", 409);

        await db.EnsureSeqAsync(businessId, ct);

        int accepted = 0, rejected = 0;
        long appliedSeq = await CurrentSeqAsync(db, businessId, ct);
        foreach (var batch in req.Batches ?? [])
        {
            if (batch == null || string.IsNullOrWhiteSpace(batch.EntityType) ||
                !EntityTypes.Contains(batch.EntityType))
            {
                rejected++;
                continue;
            }
            try
            {
                var ok = batch.EntityType switch
                {
                    "product" => await UpsertProductAsync(businessId, batch, db, ct),
                    "customer" => await UpsertCustomerAsync(businessId, batch, db, ct),
                    "provider" => await UpsertProviderAsync(businessId, batch, db, ct),
                    "order" => await UpsertOrderAsync(businessId, batch, db, ct),
                    "stockMovement" => await AppendStockMovementAsync(businessId, batch, db, ct),
                    "cashClosure" => await AppendClosureAsync(businessId, batch, db, ct),
                    "business" => await MergeBusinessAsync(businessId, batch, db, ct),
                    _ => false
                };
                if (ok) accepted++; else rejected++;
            }
            catch
            {
                db.ChangeTracker.Clear();
                rejected++;
            }
        }
        await db.SaveChangesAsync(ct);
        appliedSeq = await CurrentSeqAsync(db, businessId, ct);

        var result = new PushResponseDto
        {
            RequestId = req.RequestId, Applied = true, Duplicate = false,
            Seq = appliedSeq, Accepted = accepted, Rejected = rejected
        };
        db.SyncBatches.Add(new SyncBatch
        {
            BusinessId = businessId, RequestId = req.RequestId, OpType = req.OpType,
            AppliedSeq = appliedSeq, ResponseJson = Json.Ser(result), AppliedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync(ct);

        return Results.Ok(result);
    }

    private static async Task<bool> UpsertProductAsync(string businessId, PushBatchDto b, VendeloDbContext db, CancellationToken ct)
    {
        var p = ((JsonElement)b.Entity!).Deserialize<ProductPushDto>();
        if (p is null || string.IsNullOrWhiteSpace(p.Id) || string.IsNullOrWhiteSpace(p.Name) || p.PriceCents < 0)
            return false;
        if (b.Id != p.Id) return false;

        var existing = await db.Products.FirstOrDefaultAsync(x => x.Id == p.Id && x.BusinessId == businessId, ct);
        var seq = await db.NextSeqAsync(businessId, ct);
        if (existing is null)
        {
            existing = new Product
            {
                Id = p.Id, BusinessId = businessId, Name = p.Name.Trim(), PriceCents = p.PriceCents,
                OpeningStock = Math.Max(0, p.OpeningStock ?? 0), Active = p.Active ?? true,
                Seq = seq, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
            };
            db.Products.Add(existing);
            if (existing.OpeningStock > 0)
                db.StockMovements.Add(new StockMovement
                {
                    Id = GenId.New("smv"), BusinessId = businessId, ProductId = existing.Id,
                    MovementType = "opening", Quantity = existing.OpeningStock, Seq = await db.NextSeqAsync(businessId, ct),
                    CreatedAt = DateTimeOffset.UtcNow
                });
            return true;
        }

        existing.Name = p.Name.Trim();
        existing.PriceCents = p.PriceCents;
        if (p.Active is not null) existing.Active = p.Active.Value;
        existing.Seq = seq;
        existing.UpdatedAt = DateTimeOffset.UtcNow;
        return true;
    }

    private static async Task<bool> UpsertCustomerAsync(string businessId, PushBatchDto b, VendeloDbContext db, CancellationToken ct)
    {
        var c = ((JsonElement)b.Entity!).Deserialize<NamedPushDto>();
        if (c is null || string.IsNullOrWhiteSpace(c.Id) || string.IsNullOrWhiteSpace(c.Name)) return false;
        if (b.Id != c.Id) return false;
        var existing = await db.Customers.FirstOrDefaultAsync(x => x.Id == c.Id && x.BusinessId == businessId, ct);
        var seq = await db.NextSeqAsync(businessId, ct);
        var now = DateTimeOffset.UtcNow;
        if (existing is null)
        {
            existing = new Customer { Id = c.Id, BusinessId = businessId, Name = c.Name.Trim(), Phone = c.Phone, Address = c.Address, Description = c.Description, Seq = seq, CreatedAt = now, UpdatedAt = now };
            db.Customers.Add(existing);
        }
        else
        {
            existing.Name = c.Name.Trim();
            if (c.Phone is not null) existing.Phone = c.Phone;
            if (c.Address is not null) existing.Address = c.Address;
            if (c.Description is not null) existing.Description = c.Description;
            existing.Seq = seq;
            existing.UpdatedAt = now;
        }
        return true;
    }

    private static async Task<bool> UpsertProviderAsync(string businessId, PushBatchDto b, VendeloDbContext db, CancellationToken ct)
    {
        var p = ((JsonElement)b.Entity!).Deserialize<NamedPushDto>();
        if (p is null || string.IsNullOrWhiteSpace(p.Id) || string.IsNullOrWhiteSpace(p.Name)) return false;
        if (b.Id != p.Id) return false;
        var existing = await db.Providers.FirstOrDefaultAsync(x => x.Id == p.Id && x.BusinessId == businessId, ct);
        var seq = await db.NextSeqAsync(businessId, ct);
        var now = DateTimeOffset.UtcNow;
        if (existing is null)
        {
            existing = new Provider { Id = p.Id, BusinessId = businessId, Name = p.Name.Trim(), Phone = p.Phone, Address = p.Address, Description = p.Description, Seq = seq, CreatedAt = now };
            db.Providers.Add(existing);
        }
        else
        {
            existing.Name = p.Name.Trim();
            if (p.Phone is not null) existing.Phone = p.Phone;
            if (p.Address is not null) existing.Address = p.Address;
            if (p.Description is not null) existing.Description = p.Description;
            existing.Seq = seq;
        }
        existing.UpdatedAt = now;
        return true;
    }

    private static async Task<bool> UpsertOrderAsync(string businessId, PushBatchDto b, VendeloDbContext db, CancellationToken ct)
    {
        var o = ((JsonElement)b.Entity!).Deserialize<OrderPushDto>();
        if (o is null || string.IsNullOrWhiteSpace(o.Id) || o.Items is null || o.Items.Count == 0) return false;
        if (b.Id != o.Id) return false;
        if (o.Items.Any(i => i.ProductId is null || i.ProductId.Length is 0 or > 64 || i.Quantity <= 0 || i.UnitPriceCents < 0))
            return false;
        if (o.Status is not (OrderStatus.Pending or OrderStatus.Paid or OrderStatus.Voided)) return false;
        if (o.OrderType == "waiter" && string.IsNullOrWhiteSpace(o.WaiterId)) return false;

        var existing = await db.Orders.FirstOrDefaultAsync(x => x.Id == o.Id && x.BusinessId == businessId, ct);
        var now = DateTimeOffset.UtcNow;

        if (existing is not null)
        {
            if (existing.Status == OrderStatus.Paid && existing.Status != o.Status) return false;
            existing.ItemsJson = Json.Ser(o.Items);
            existing.TotalCents = o.Items.Sum(i => i.LineTotalCents);
            if (o.PrepStatus is not null) existing.PrepStatus = o.PrepStatus;
            if (o.OrderType is not null) existing.OrderType = o.OrderType;
            if (o.WaiterId is not null) existing.WaiterId = o.WaiterId;
            if (o.WaiterName is not null) existing.WaiterName = o.WaiterName;
            if (o.TableId is not null) existing.TableId = o.TableId;
            if (o.TableName is not null) existing.TableName = o.TableName;
            if (o.CustomerId is not null) existing.CustomerId = o.CustomerId;
            if (o.CustomerName is not null) existing.CustomerName = o.CustomerName;
            if (o.PaymentMethod is not null) existing.PaymentMethod = o.PaymentMethod;
            existing.Seq = await db.NextSeqAsync(businessId, ct);
            existing.UpdatedAt = now;
        }
        else
        {
            existing = new Order
            {
                Id = o.Id, BusinessId = businessId, Status = OrderStatus.Pending,
                OrderType = o.OrderType, WaiterId = o.WaiterId, WaiterName = o.WaiterName,
                TableId = o.TableId, TableName = o.TableName, CustomerId = o.CustomerId,
                CustomerName = o.CustomerName, CustomerPhone = o.CustomerPhone,
                CustomerAddress = o.CustomerAddress, CustomerDescription = o.CustomerDescription,
                PrepStatus = o.PrepStatus, PaymentMethod = o.PaymentMethod,
                ItemsJson = Json.Ser(o.Items), TotalCents = o.Items.Sum(i => i.LineTotalCents),
                EventsJson = "[]", Seq = await db.NextSeqAsync(businessId, ct),
                CreatedAt = now, UpdatedAt = now
            };
            db.Orders.Add(existing);
        }

        if (o.Status == OrderStatus.Paid && existing.Number <= 0)
        {
            var business = await db.Businesses.FirstAsync(x => x.Id == businessId, ct);
            existing.Number = business.NextOrderNumber;
            business.NextOrderNumber++;
            existing.Status = OrderStatus.Paid;
            existing.PaidAt = now;
            existing.Overventa = false;
        }
        else if (o.Status == OrderStatus.Voided && existing.Status == OrderStatus.Pending)
        {
            existing.Status = OrderStatus.Voided;
        }

        if (existing.Status == OrderStatus.Paid &&
            !await db.StockMovements.AnyAsync(x => x.OrderId == existing.Id, ct))
        {
            var overventa = false;
            foreach (var g in o.Items.GroupBy(i => i.ProductId!))
            {
                var productId = g.Key;
                var qty = g.Sum(i => i.Quantity);
                if (!await db.Products.AnyAsync(x => x.Id == productId && x.BusinessId == businessId, ct))
                    throw new AppException("INVALID_STATE", $"Producto {productId} desconocido.", 409);
                var sum = await db.StockMovements.AsNoTracking()
                    .Where(x => x.BusinessId == businessId && x.ProductId == productId)
                    .SumAsync(x => (long?)x.Quantity, ct) ?? 0;
                var opening = (await db.Products.AsNoTracking().FirstAsync(x => x.Id == productId && x.BusinessId == businessId, ct)).OpeningStock;
                if (opening + sum - qty < 0) overventa = true;
                db.StockMovements.Add(new StockMovement
                {
                    Id = GenId.New("smv"), BusinessId = businessId, ProductId = productId,
                    MovementType = "sale", Quantity = -qty, AmountCents = g.Sum(i => i.LineTotalCents),
                    OrderId = existing.Id, Seq = await db.NextSeqAsync(businessId, ct), CreatedAt = now
                });
            }
            existing.Overventa = overventa;
        }

        return true;
    }

    private static async Task<bool> AppendStockMovementAsync(string businessId, PushBatchDto b, VendeloDbContext db, CancellationToken ct)
    {
        if (b.Action == "delete") return false;
        var m = ((JsonElement)b.Entity!).Deserialize<StockPushDto>();
        if (m is null || string.IsNullOrWhiteSpace(m.Id) || string.IsNullOrWhiteSpace(m.ProductId) ||
            string.IsNullOrWhiteSpace(m.MovementType)) return false;
        var existing = await db.StockMovements.FirstOrDefaultAsync(x => x.Id == m.Id && x.BusinessId == businessId, ct);
        if (existing is not null) return true;
        db.StockMovements.Add(new StockMovement
        {
            Id = m.Id, BusinessId = businessId, ProductId = m.ProductId, MovementType = m.MovementType,
            Quantity = m.Quantity, AmountCents = m.AmountCents, OrderId = m.OrderId, DeviceId = m.DeviceId,
            Seq = await db.NextSeqAsync(businessId, ct), CreatedAt = DateTimeOffset.UtcNow
        });
        return true;
    }

    private static async Task<bool> AppendClosureAsync(string businessId, PushBatchDto b, VendeloDbContext db, CancellationToken ct)
    {
        if (b.Action == "delete") return false;
        var c = ((JsonElement)b.Entity!).Deserialize<ClosurePushDto>();
        if (c is null || string.IsNullOrWhiteSpace(c.Id)) return false;
        var existing = await db.CashClosures.FirstOrDefaultAsync(x => x.Id == c.Id && x.BusinessId == businessId, ct);
        if (existing is not null) return true;
        db.CashClosures.Add(new CashClosure
        {
            Id = c.Id, BusinessId = businessId, RegisterId = c.RegisterId ?? "cash",
            OpeningAmountCents = c.OpeningAmountCents ?? 0, ExpectedCents = c.ExpectedCents ?? 0,
            ClosingAmountCents = c.ClosingAmountCents ?? 0, DifferenceCents = c.DifferenceCents ?? 0,
            SalesByMethodJson = c.SalesByMethod is null ? "{}" : Json.Ser(c.SalesByMethod),
            Overventa = c.Overventa ?? false, Seq = await db.NextSeqAsync(businessId, ct),
            OpenedAt = DateTimeOffset.UtcNow, ClosedAt = DateTimeOffset.UtcNow
        });
        return true;
    }

    private static async Task<bool> MergeBusinessAsync(string businessId, PushBatchDto b, VendeloDbContext db, CancellationToken ct)
    {
        var biz = ((JsonElement)b.Entity!).Deserialize<BusinessDto>();
        if (biz is null || string.IsNullOrWhiteSpace(biz.Id) || biz.Id != businessId) return false;
        var row = await db.Businesses.FirstAsync(x => x.Id == businessId, ct);
        if (!string.IsNullOrWhiteSpace(biz.Name)) row.Name = biz.Name.Trim();
        if (biz.OwnerName is not null) row.OwnerName = biz.OwnerName;
        if (biz.BusinessType is not null && IsValidType(biz.BusinessType)) row.BusinessType = biz.BusinessType;
        if (biz.Settings is not null && IsJsonObject(biz.Settings))
        {
            var merge = new Dictionary<string, object?>(row.Settings);
            foreach (var (k, v) in DeserializeDict(biz.Settings))
                merge[k] = v;
            row.SettingsJson = Json.Ser(merge);
        }
        row.UpdatedAt = DateTimeOffset.UtcNow;
        return true;
    }

    #region helpers
    private static readonly TimeSpan RlWindow = TimeSpan.FromMinutes(1);
    private static bool IsJsonObject(object o) => o is JsonObject or Dictionary<string, object?>;
    private static bool IsValidType(string t) => t is "COMMERCE" or "RESTAURANT" or "FOOD_TRUCK" or "MOBILE_VENDOR" or "SERVICE" or "OTHER";
    private static Dictionary<string, object?> DeserializeDict(object o)
    {
        if (o is Dictionary<string, object?> d) return d;
        if (o is JsonObject jo) return Json.DeserializeDict(jo.ToJsonString());
        var text = o is JsonElement je ? je.GetRawText() : o.ToString();
        return Json.DeserializeDict(text);
    }

    private static long ParseSeq(string? since, out bool snapshot)
    {
        snapshot = string.IsNullOrWhiteSpace(since) || since == "null";
        if (snapshot) return 0;
        var s = since!.Trim();
        if (s.StartsWith("seq:", StringComparison.OrdinalIgnoreCase)) s = s[4..];
        return long.TryParse(s, out var v) && v >= 0 ? v : 0;
    }

    private static string SeqCursor(long v) => $"seq:{v}";

    private static async Task<long> CurrentSeqAsync(VendeloDbContext db, string businessId, CancellationToken ct)
    {
        var row = await db.Sequences.AsNoTracking().FirstOrDefaultAsync(x => x.BusinessId == businessId, ct);
        return row is null ? 0 : Math.Max(0, row.NextSeq - 1);
    }
    #endregion
}

#region Push DTOs (campos del contrato)
public sealed class ProductPushDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("priceCents")] public long PriceCents { get; set; }
    [JsonPropertyName("openingStock")] public long? OpeningStock { get; set; }
    [JsonPropertyName("active")] public bool? Active { get; set; }
}

public sealed class NamedPushDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("phone")] public string? Phone { get; set; }
    [JsonPropertyName("address")] public string? Address { get; set; }
    [JsonPropertyName("description")] public string? Description { get; set; }
}

public sealed class OrderPushItemDto
{
    [JsonPropertyName("productId")] public string? ProductId { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("quantity")] public long Quantity { get; set; }
    [JsonPropertyName("unitPriceCents")] public long UnitPriceCents { get; set; }
    [JsonPropertyName("lineTotalCents")] public long LineTotalCents { get; set; }
}

public sealed class OrderPushDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("prepStatus")] public string? PrepStatus { get; set; }
    [JsonPropertyName("orderType")] public string? OrderType { get; set; }
    [JsonPropertyName("waiterId")] public string? WaiterId { get; set; }
    [JsonPropertyName("waiterName")] public string? WaiterName { get; set; }
    [JsonPropertyName("tableId")] public string? TableId { get; set; }
    [JsonPropertyName("tableName")] public string? TableName { get; set; }
    [JsonPropertyName("customerId")] public string? CustomerId { get; set; }
    [JsonPropertyName("customerName")] public string? CustomerName { get; set; }
    [JsonPropertyName("customerPhone")] public string? CustomerPhone { get; set; }
    [JsonPropertyName("customerAddress")] public string? CustomerAddress { get; set; }
    [JsonPropertyName("customerDescription")] public string? CustomerDescription { get; set; }
    [JsonPropertyName("paymentMethod")] public string? PaymentMethod { get; set; }
    [JsonPropertyName("items")] public List<OrderPushItemDto>? Items { get; set; }
}

public sealed class StockPushDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("productId")] public string ProductId { get; set; } = "";
    [JsonPropertyName("movementType")] public string MovementType { get; set; } = "";
    [JsonPropertyName("quantity")] public long Quantity { get; set; }
    [JsonPropertyName("amountCents")] public long? AmountCents { get; set; }
    [JsonPropertyName("orderId")] public string? OrderId { get; set; }
    [JsonPropertyName("deviceId")] public string? DeviceId { get; set; }
}

public sealed class ClosurePushDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("registerId")] public string? RegisterId { get; set; }
    [JsonPropertyName("openingAmountCents")] public long? OpeningAmountCents { get; set; }
    [JsonPropertyName("expectedCents")] public long? ExpectedCents { get; set; }
    [JsonPropertyName("closingAmountCents")] public long? ClosingAmountCents { get; set; }
    [JsonPropertyName("differenceCents")] public long? DifferenceCents { get; set; }
    [JsonPropertyName("salesByMethod")] public object? SalesByMethod { get; set; }
    [JsonPropertyName("overventa")] public bool? Overventa { get; set; }
}
#endregion