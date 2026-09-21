using Microsoft.EntityFrameworkCore;
using Vendelo.Api.Common;
using Vendelo.Api.Data;

namespace Vendelo.Api.Endpoints;

public static class OrderEndpoints
{
    public static void MapOrderEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/v1/businesses/{businessId}");

        g.MapPost("/orders", CreateAsync).RequireAuthorization();
        g.MapGet("/orders", ListAsync).RequireAuthorization();
        g.MapPatch("/orders/{orderId}", PatchAsync).RequireAuthorization();
        g.MapPost("/orders/{orderId}/pay", PayAsync).RequireAuthorization();
        g.MapPost("/orders/{orderId}/void", VoidAsync).RequireAuthorization();

        g.MapPost("/stock/{productId}/adjust", AdjustStockAsync).RequireAuthorization();
        g.MapPost("/cash/open", CashOpenAsync).RequireAuthorization();
        g.MapPost("/cash/close", CashCloseAsync).RequireAuthorization();
        g.MapGet("/cash/closures", ListClosuresAsync).RequireAuthorization();
    }

    private static async Task<EffectiveAccess> AccessAsync(string businessId, HttpContext http, AccessService access, string permission, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != businessId) throw AppException.NotFound("negocio");
        AccessService.Require(a, permission);
        return a;
    }

    private static async Task<IResult> CreateAsync(
        string businessId, OrderRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await AccessAsync(businessId, http, access, "orders.create", ct);
        if (req.Items is null || req.Items.Count == 0)
            throw new AppException("VALIDATION_ERROR", "items no puede estar vacío.", 400);
        if (req.Items.Any(i => i.Quantity <= 0 || i.UnitPriceCents < 0 || i.LineTotalCents != i.Quantity * i.UnitPriceCents))
            throw new AppException("VALIDATION_ERROR", "items inválidos.", 400);

        var orderType = req.OrderType ?? "pos";
        if (orderType == "waiter")
        {
            AccessService.RequireCapability(a, "waiters");
            var hasIdentity = !string.IsNullOrWhiteSpace(req.WaiterId) &&
                (!string.IsNullOrEmpty(req.TableId) || !string.IsNullOrEmpty(req.TableName) ||
                 !string.IsNullOrEmpty(req.CustomerId) || !string.IsNullOrWhiteSpace(req.CustomerName));
            if (!hasIdentity)
                throw new AppException("anonymous_order", "La orden de mesero necesita waiter y mesa o cliente.", 400);
        }
        if ((req.TableId is not null || req.TableName is not null) && orderType != "waiter")
            AccessService.RequireCapability(a, "tables");

        var now = DateTimeOffset.UtcNow;
        var id = GenId.NewId(req.Id, "order");
        var total = req.Items.Sum(i => i.LineTotalCents);
        var events = new List<object>();
        if (req.PrepStatus is not null && req.PrepStatus != OrderPrepStatus.New)
            events.Add(new { type = "prepStatusChanged", prepStatus = req.PrepStatus, at = now.ToString("O") });

        var o = new Order
        {
            Id = id,
            BusinessId = businessId,
            Number = 0,
            Status = OrderStatus.Pending,
            PrepStatus = req.PrepStatus,
            OrderType = orderType,
            WaiterId = req.WaiterId,
            WaiterName = req.WaiterName,
            TableId = req.TableId,
            TableName = req.TableName,
            CustomerId = req.CustomerId,
            CustomerName = req.CustomerName,
            CustomerPhone = req.CustomerPhone,
            CustomerAddress = req.CustomerAddress,
            CustomerDescription = req.CustomerDescription,
            TotalCents = total,
            ItemsJson = Json.Ser(req.Items),
            EventsJson = Json.Ser(events),
            Seq = await db.NextSeqAsync(businessId, ct),
            CreatedAt = now,
            UpdatedAt = now
        };
        if (await db.Orders.AnyAsync(x => x.Id == id && x.BusinessId == businessId, ct))
            throw new AppException("CONFLICT", "La orden ya existe.", 409);
        db.Orders.Add(o);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/v1/businesses/{businessId}/orders/{id}", OrderDto.From(o));
    }

    private static async Task<IResult> ListAsync(string businessId, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        await AccessAsync(businessId, http, access, "orders.read", ct);
        var list = await db.Orders.AsNoTracking().Where(x => x.BusinessId == businessId).OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Take(500).ToListAsync(ct);
        return Results.Ok(list.Select(OrderDto.From));
    }

    private static async Task<IResult> PatchAsync(
        string businessId, string orderId, OrderPatchRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await AccessAsync(businessId, http, access, "orders.create", ct);
        var o = await db.Orders.FirstOrDefaultAsync(x => x.Id == orderId && x.BusinessId == businessId, ct)
            ?? throw AppException.NotFound("orden");
        if (o.Status != OrderStatus.Pending)
            throw AppException.InvalidState("Solo se puede editar una orden pendiente.");
        if (o.PrepStatus is not null && o.PrepStatus != OrderPrepStatus.New)
            throw AppException.InvalidState("La orden ya fue enviada a cocina; cancela y recrea.");

        if (req.CustomerName is not null) o.CustomerName = req.CustomerName;
        if (req.CustomerPhone is not null) o.CustomerPhone = req.CustomerPhone;
        if (req.CustomerAddress is not null) o.CustomerAddress = req.CustomerAddress;
        if (req.CustomerDescription is not null) o.CustomerDescription = req.CustomerDescription;
        if (req.WaiterName is not null) o.WaiterName = req.WaiterName;
        if (req.TableName is not null) o.TableName = req.TableName;
        if (req.Items is { Count: > 0 })
        {
            if (req.Items.Any(i => i.Quantity <= 0 || i.UnitPriceCents < 0 || i.LineTotalCents != i.Quantity * i.UnitPriceCents))
                throw new AppException("VALIDATION_ERROR", "items inválidos.", 400);
            o.ItemsJson = Json.Ser(req.Items);
            o.TotalCents = req.Items.Sum(i => i.LineTotalCents);
        }
        if (req.PrepStatus is not null && req.PrepStatus != OrderPrepStatus.New)
        {
            AccessService.RequireCapability(a, "kitchen");
            var events = Json.Des<List<object>>(o.EventsJson) ?? [];
            events.Add(new { type = "prepStatusChanged", prepStatus = req.PrepStatus, at = DateTimeOffset.UtcNow.ToString("O") });
            o.EventsJson = Json.Ser(events);
        }

        o.Seq = await db.NextSeqAsync(businessId, ct);
        o.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Results.Ok(OrderDto.From(o));
    }

    private static async Task<IResult> PayAsync(
        string businessId, string orderId, PayOrderRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await AccessAsync(businessId, http, access, "orders.pay", ct);
        var o = await db.Orders.FirstOrDefaultAsync(x => x.Id == orderId && x.BusinessId == businessId, ct)
            ?? throw AppException.NotFound("orden");
        if (o.Status != OrderStatus.Pending)
            throw AppException.InvalidState("La orden no está pendiente.");
        if (req.ReceivedCents < o.TotalCents)
            throw new AppException("VALIDATION_ERROR", "El monto recibido es menor al total.", 400);
        if (string.IsNullOrWhiteSpace(req.PaymentMethod))
            throw new AppException("VALIDATION_ERROR", "paymentMethod es obligatorio.", 400);

        var business = await db.Businesses.FirstAsync(x => x.Id == businessId, ct);
        if (o.Number <= 0)
        {
            o.Number = business.NextOrderNumber;
            business.NextOrderNumber++;
        }

        var items = Json.Des<List<OrderItemDto>>(o.ItemsJson) ?? [];
        var overventa = false;
        foreach (var g in items.GroupBy(i => i.ProductId))
        {
            var productId = g.Key;
            var qty = g.Sum(i => i.Quantity);
            var amount = g.Sum(i => i.LineTotalCents);
            var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(x => x.Id == productId && x.BusinessId == businessId, ct);
            if (product is null)
                throw AppException.InvalidState($"El producto {productId} no existe en el catálogo.");
            var sumMovements = await db.StockMovements.AsNoTracking()
                .Where(x => x.BusinessId == businessId && x.ProductId == productId)
                .SumAsync(x => (long?)x.Quantity, ct) ?? 0;
            if (product.OpeningStock + sumMovements - qty < 0) overventa = true;

            db.StockMovements.Add(new StockMovement
            {
                Id = GenId.New("smv"),
                BusinessId = businessId,
                ProductId = productId,
                MovementType = "sale",
                Quantity = -qty,
                AmountCents = amount,
                OrderId = o.Id,
                DeviceId = http.User.DeviceIdOf(),
                Seq = await db.NextSeqAsync(businessId, ct),
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        var now = DateTimeOffset.UtcNow;
        o.Status = OrderStatus.Paid;
        o.PaidAt = now;
        o.PaymentMethod = req.PaymentMethod;
        o.ReceivedCents = req.ReceivedCents;
        o.ChangeCents = req.ReceivedCents - o.TotalCents;
        o.Overventa = overventa;
        var events = Json.Des<List<object>>(o.EventsJson) ?? [];
        events.Add(new { type = "paid", at = now.ToString("O"), method = req.PaymentMethod });
        o.EventsJson = Json.Ser(events);
        o.Seq = await db.NextSeqAsync(businessId, ct);
        o.UpdatedAt = now;
        await db.SaveChangesAsync(ct);

        return Results.Ok(new PayOrderResponseDto
        {
            Order = OrderDto.From(o),
            InvoiceNumber = o.Number,
            Overventa = overventa
        });
    }

    private static async Task<IResult> VoidAsync(
        string businessId, string orderId, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        await AccessAsync(businessId, http, access, "orders.void", ct);
        var o = await db.Orders.FirstOrDefaultAsync(x => x.Id == orderId && x.BusinessId == businessId, ct)
            ?? throw AppException.NotFound("orden");
        if (o.Status != OrderStatus.Pending)
            throw AppException.InvalidState("En F3 solo se anulan órdenes pendientes (post-pago: F11).");
        var now = DateTimeOffset.UtcNow;
        o.Status = OrderStatus.Voided;
        var events = Json.Des<List<object>>(o.EventsJson) ?? [];
        events.Add(new { type = "cancelled", at = now.ToString("O") });
        o.EventsJson = Json.Ser(events);
        o.Seq = await db.NextSeqAsync(businessId, ct);
        o.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        return Results.Ok(OrderDto.From(o));
    }

    private static async Task<IResult> AdjustStockAsync(
        string businessId, string productId, StockAdjustRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        await AccessAsync(businessId, http, access, "products.crud", ct);
        if (req is null || (req.MovementType != "purchase" && req.MovementType != "adjustment"))
            throw new AppException("VALIDATION_ERROR", "movementType debe ser purchase o adjustment.", 400);
        if (req.Quantity == 0)
            throw new AppException("VALIDATION_ERROR", "quantity no puede ser 0.", 400);
        var product = await db.Products.FirstOrDefaultAsync(x => x.Id == productId && x.BusinessId == businessId, ct)
            ?? throw AppException.NotFound("producto");

        var m = new StockMovement
        {
            Id = GenId.New("smv"),
            BusinessId = businessId,
            ProductId = productId,
            MovementType = req.MovementType,
            Quantity = req.Quantity,
            AmountCents = req.AmountCents,
            DeviceId = http.User.DeviceIdOf(),
            Seq = await db.NextSeqAsync(businessId, ct),
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.StockMovements.Add(m);
        await db.SaveChangesAsync(ct);
        return Results.Ok(StockMovementDto.From(m));
    }

    private static async Task<IResult> CashOpenAsync(
        string businessId, CashOpenRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        await AccessAsync(businessId, http, access, "cash.close", ct);
        if (await db.CashRegisters.AnyAsync(x => x.BusinessId == businessId && x.State == "open", ct))
            throw AppException.InvalidState("Ya hay una caja abierta.");
        var r = new CashRegister
        {
            Id = GenId.NewId(req?.Id, "cash"),
            BusinessId = businessId,
            OpeningAmountCents = req?.OpeningAmountCents ?? 0,
            OpenedAt = DateTimeOffset.UtcNow,
            State = "open"
        };
        db.CashRegisters.Add(r);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/v1/businesses/{businessId}/cash/register/{r.Id}",
            new { r.Id, r.BusinessId, r.OpeningAmountCents, r.State, OpenedAt = r.OpenedAt.ToString("O") });
    }

    private static async Task<IResult> CashCloseAsync(
        string businessId, CashCloseRequestDto req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await AccessAsync(businessId, http, access, "cash.close", ct);
        var reg = await db.CashRegisters.FirstOrDefaultAsync(x => x.BusinessId == businessId && x.State == "open", ct)
            ?? throw AppException.InvalidState("No hay caja abierta.");
        var now = DateTimeOffset.UtcNow;
        var paid = await db.Orders.AsNoTracking().Where(o =>
                o.BusinessId == businessId && o.Status == OrderStatus.Paid &&
                o.PaidAt >= reg.OpenedAt && o.PaidAt <= now)
            .ToListAsync(ct);

        var expected = reg.OpeningAmountCents + paid.Sum(o => o.TotalCents);
        var closing = req?.ClosingAmountCents ?? 0;
        var salesByMethod = paid.GroupBy(o => o.PaymentMethod ?? "unknown")
            .ToDictionary(g => g.Key, g => g.Sum(o => o.TotalCents));

        var closure = new CashClosure
        {
            Id = GenId.New("close"),
            BusinessId = businessId,
            RegisterId = reg.Id,
            OpeningAmountCents = reg.OpeningAmountCents,
            ExpectedCents = expected,
            ClosingAmountCents = closing,
            DifferenceCents = closing - expected,
            SalesByMethodJson = Json.Ser(salesByMethod),
            Overventa = paid.Any(o => o.Overventa),
            Seq = await db.NextSeqAsync(businessId, ct),
            OpenedAt = reg.OpenedAt,
            ClosedAt = now
        };
        reg.State = "closed";
        db.CashClosures.Add(closure);
        await db.SaveChangesAsync(ct);
        return Results.Ok(CashClosureDto.From(closure));
    }

    private static async Task<IResult> ListClosuresAsync(string businessId, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        await AccessAsync(businessId, http, access, "orders.read", ct);
        var list = await db.CashClosures.AsNoTracking().Where(x => x.BusinessId == businessId).OrderByDescending(x => x.ClosedAt).Take(200).ToListAsync(ct);
        return Results.Ok(list.Select(CashClosureDto.From));
    }
}

public sealed class OrderPatchRequestDto
{
    [System.Text.Json.Serialization.JsonPropertyName("customerName")] public string? CustomerName { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("customerPhone")] public string? CustomerPhone { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("customerAddress")] public string? CustomerAddress { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("customerDescription")] public string? CustomerDescription { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("waiterName")] public string? WaiterName { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("tableName")] public string? TableName { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("items")] public List<OrderItemDto>? Items { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("prepStatus")] public string? PrepStatus { get; set; }
}
