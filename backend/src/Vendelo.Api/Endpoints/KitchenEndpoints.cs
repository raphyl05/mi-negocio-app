using Microsoft.EntityFrameworkCore;
using Vendelo.Api.Common;
using Vendelo.Api.Data;

namespace Vendelo.Api.Endpoints;

public static class KitchenEndpoints
{
    public static void MapKitchenEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/v1/businesses/{businessId}");

        g.MapPost("/orders/{orderId}/kitchen", CreateTicketAsync).RequireAuthorization();
        g.MapPost("/orders/{orderId}/kitchen/status", UpdateStatusAsync).RequireAuthorization();
        g.MapDelete("/orders/{orderId}/kitchen", CancelTicketAsync).RequireAuthorization();
    }

    private static async Task<EffectiveAccess> AccessAsync(string businessId, HttpContext http, AccessService access, CancellationToken ct)
    {
        var a = await access.ResolveAsync(http.User, http.User.DeviceIdOf(), ct);
        if (a.Business.Id != businessId) throw AppException.NotFound("negocio");
        return a;
    }

    private static async Task<IResult> CreateTicketAsync(
        string businessId, string orderId, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await AccessAsync(businessId, http, access, ct);
        AccessService.RequireCapability(a, "kitchen");

        var o = await db.Orders.FirstOrDefaultAsync(x => x.Id == orderId && x.BusinessId == businessId, ct)
            ?? throw AppException.NotFound("orden");

        if (o.KitchenTicketId is not null)
            throw AppException.InvalidState("La comanda ya fue creada.");

        var now = DateTimeOffset.UtcNow;
        o.PrepStatus = OrderPrepStatus.Sent;
        o.KitchenTicketId = GenId.New("kt");
        o.UpdatedAt = now;

        var events = Json.Des<List<object>>(o.EventsJson) ?? [];
        events.Add(new { type = "kitchenTicketCreated", kitchenTicketId = o.KitchenTicketId, at = now.ToString("O") });
        events.Add(new { type = "prepStatusChanged", prepStatus = OrderPrepStatus.Sent, at = now.ToString("O") });
        o.EventsJson = Json.Ser(events);

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { kitchenTicketId = o.KitchenTicketId, prepStatus = o.PrepStatus });
    }

    private static async Task<IResult> UpdateStatusAsync(
        string businessId, string orderId, UpdateKitchenStatusRequest req, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await AccessAsync(businessId, http, access, ct);
        AccessService.RequireCapability(a, "kitchen");

        var o = await db.Orders.FirstOrDefaultAsync(x => x.Id == orderId && x.BusinessId == businessId, ct)
            ?? throw AppException.NotFound("orden");

        if (o.KitchenTicketId is null)
            throw AppException.InvalidState("La comanda no ha sido creada. Primero crea la comanda.");

        if (o.PrepStatus == OrderPrepStatus.Served)
            throw AppException.InvalidState("La orden ya fue entregada.");

        var validTransitions = new Dictionary<string, HashSet<string>>
        {
            [OrderPrepStatus.Sent] = [OrderPrepStatus.Preparing],
            [OrderPrepStatus.Preparing] = [OrderPrepStatus.Ready],
            [OrderPrepStatus.Ready] = [OrderPrepStatus.Served],
        };

        if (!validTransitions.TryGetValue(o.PrepStatus ?? "", out var allowed) || !allowed.Contains(req.PrepStatus))
            throw AppException.InvalidState(
                $"Transición inválida: {o.PrepStatus} → {req.PrepStatus}. Estados válidos: sent → preparing → ready → served.");

        var now = DateTimeOffset.UtcNow;
        o.PrepStatus = req.PrepStatus;
        o.UpdatedAt = now;

        var events = Json.Des<List<object>>(o.EventsJson) ?? [];
        events.Add(new { type = "prepStatusChanged", prepStatus = req.PrepStatus, at = now.ToString("O") });
        o.EventsJson = Json.Ser(events);

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { prepStatus = o.PrepStatus });
    }

    private static async Task<IResult> CancelTicketAsync(
        string businessId, string orderId, HttpContext http, VendeloDbContext db, AccessService access, CancellationToken ct)
    {
        var a = await AccessAsync(businessId, http, access, ct);
        AccessService.RequireCapability(a, "kitchen");

        var o = await db.Orders.FirstOrDefaultAsync(x => x.Id == orderId && x.BusinessId == businessId, ct)
            ?? throw AppException.NotFound("orden");

        if (o.KitchenTicketId is null)
            throw AppException.InvalidState("La comanda no existe.");

        var now = DateTimeOffset.UtcNow;
        o.PrepStatus = null;
        o.KitchenTicketId = null;
        o.UpdatedAt = now;

        var events = Json.Des<List<object>>(o.EventsJson) ?? [];
        events.Add(new { type = "kitchenTicketCancelled", at = now.ToString("O") });
        o.EventsJson = Json.Ser(events);

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { cancelled = true });
    }
}

public sealed class UpdateKitchenStatusRequest
{
    [System.Text.Json.Serialization.JsonPropertyName("prepStatus")] public string PrepStatus { get; set; } = "";
}
