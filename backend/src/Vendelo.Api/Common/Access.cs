using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Vendelo.Api.Data;

namespace Vendelo.Api.Common;

public sealed record EffectiveAccess(
    User User,
    Business Business,
    Membership Membership,
    string DeviceRole,
    string Role) { }

public sealed class AccessService(VendeloDbContext db)
{
    private static readonly Dictionary<string, HashSet<string>> R = new()
    {
        [Roles.Owner] = All(),
        [Roles.Admin] = AllExcept("backups"),
        [Roles.Cashier] = ["products.crud", "orders.create", "orders.pay", "orders.void", "orders.read", "stock.view"],
        [Roles.Waiter] = ["orders.create", "orders.read", "tables.use", "orders.own"],
        [Roles.Kitchen] = ["orders.read", "kitchen.status"],
        [Roles.Printer] = ["orders.read", "printer.feed"],
    };

    private static HashSet<string> All() =>
        ["products.crud", "orders.create", "orders.pay", "orders.void", "orders.read", "orders.own",
         "kitchen.status", "tables.use", "members.devices", "capabilities", "cash.close", "backups", "stock.view"];

    private static HashSet<string> AllExcept(string ex) => All().Where(x => x != ex).ToHashSet();

    public static bool Has(string role, string permission) =>
        R.TryGetValue(role, out var perms) && perms.Contains(permission);

    public static string Intersect(string membershipRole, string deviceRole)
    {
        if (deviceRole is null or "*" or "" or Roles.Admin or Roles.Owner) return membershipRole;
        if (membershipRole == deviceRole) return membershipRole;
        var m = R.TryGetValue(membershipRole, out var mr) ? mr : new HashSet<string>();
        var d = R.TryGetValue(deviceRole, out var dr) ? dr : new HashSet<string>();
        var cap = m.Intersect(d).ToHashSet();
        return R.Where(kv => kv.Value.SetEquals(cap)).Select(kv => kv.Key)
                .OrderBy(x => R[x].Count).FirstOrDefault(membershipRole);
    }

    public async Task<EffectiveAccess> ResolveAsync(ClaimsPrincipal user, string deviceId, CancellationToken ct = default)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        var businessId = user.FindFirstValue("busid");
        if (userId is null || businessId is null)
            throw AppException.Forbidden("Sesión incompleta.");

        var who = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId, ct)
            ?? throw AppException.NotFound("usuario");
        var business = await db.Businesses.AsNoTracking().FirstOrDefaultAsync(x => x.Id == businessId, ct)
            ?? throw AppException.NotFound("negocio");
        var membership = await db.Memberships.AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId && x.BusinessId == businessId && x.Active, ct)
            ?? throw AppException.Forbidden("No eres miembro activo de este negocio.");

        string deviceRole = "*";
        if (!string.IsNullOrEmpty(deviceId))
        {
            var device = await db.Devices.AsNoTracking().FirstOrDefaultAsync(
                x => x.Id == deviceId && x.BusinessId == businessId, ct);
            if (device is not null)
            {
                if (!device.Active) throw AppException.Forbidden("Dispositivo revocado.");
                deviceRole = device.Role ?? "*";
            }
        }

        return new EffectiveAccess(who, business, membership, deviceRole,
            Intersect(membership.Role, deviceRole));
    }

    public static void Require(EffectiveAccess a, string permission)
    {
        if (!Has(a.Role, permission))
            throw AppException.Forbidden("No tienes permiso para esta operación.");
    }

    public static void RequireCapability(EffectiveAccess a, string key)
    {
        var caps = a.Business.Capabilities;
        if (caps.TryGetValue(key, out var on) && Json.AsBool(on)) return;
        throw new AppException("FEATURE_DISABLED",
            $"La función '{key}' está desactivada para este negocio.", 403);
    }
}

public static class ClaimHelpers
{
    public static string? DeviceIdOf(this ClaimsPrincipal p) => p.FindFirstValue("dev");
    public static string? UserIdOf(this ClaimsPrincipal p) => p.FindFirstValue(ClaimTypes.NameIdentifier);
    public static string? BusinessIdOf(this ClaimsPrincipal p) => p.FindFirstValue("busid");
    public static string? RoleOf(this ClaimsPrincipal p) => p.FindFirstValue("role");
}