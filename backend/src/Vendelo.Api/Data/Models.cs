using System.Text.Json.Serialization;

namespace Vendelo.Api.Data;

public static class Roles
{
    public const string Owner = "owner";
    public const string Admin = "admin";
    public const string Cashier = "cashier";
    public const string Waiter = "waiter";
    public const string Kitchen = "kitchen";
    public const string Printer = "printer";
    public static readonly string[] All = [Owner, Admin, Cashier, Waiter, Kitchen, Printer];
}

public static class OrderStatus
{
    public const string Pending = "pending";
    public const string Paid = "paid";
    public const string Voided = "voided";
}

public static class OrderPrepStatus
{
    public const string New = "new";
    public const string Sent = "sent";
    public const string Preparing = "preparing";
    public const string Ready = "ready";
    public const string Served = "served";
}

public sealed class User
{
    public string Id { get; set; } = "";
    public string Username { get; set; } = "";
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string PasswordHash { get; set; } = "";
    public DateTimeOffset ChangeEpoch { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class Membership
{
    public string Id { get; set; } = "";
    public string UserId { get; set; } = "";
    public string BusinessId { get; set; } = "";
    public string Role { get; set; } = Roles.Owner;
    public bool Active { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class Business
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string? OwnerName { get; set; }
    public string BusinessType { get; set; } = "COMMERCE";
    public string CapabilitiesJson { get; set; } = "{}";
    public string SettingsJson { get; set; } = "{}";
    public long CapabilityVersion { get; set; } = 1;
    public long NextOrderNumber { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Dictionary<string, object?> Capabilities =>
        Json.DeserializeDict(CapabilitiesJson);
    public Dictionary<string, object?> Settings =>
        Json.DeserializeDict(SettingsJson);
}

public sealed class Device
{
    public string Id { get; set; } = "";
    public string BusinessId { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Role { get; set; }
    public bool Active { get; set; } = true;
    public DateTimeOffset RegisteredAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class DeviceSession
{
    public string Id { get; set; } = "";
    public string DeviceId { get; set; } = "";
    public string UserId { get; set; } = "";
    public string RefreshTokenHash { get; set; } = "";
    public bool Active { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddHours(48);
    public DateTimeOffset AbsoluteExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddDays(30);
}

public sealed class OrganizationSequence
{
    public string BusinessId { get; set; } = "";
    public long NextSeq { get; set; } = 1;
}

public sealed class SyncBatch
{
    public string BusinessId { get; set; } = "";
    public string RequestId { get; set; } = "";
    public string OpType { get; set; } = "incremental";
    public long AppliedSeq { get; set; }
    public string ResponseJson { get; set; } = "{}";
    public DateTimeOffset AppliedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class SyncRow
{
    public string Id { get; set; } = "";
    public string BusinessId { get; set; } = "";
}

public sealed class Product : SyncRow
{
    public string Name { get; set; } = "";
    public long PriceCents { get; set; }
    public long OpeningStock { get; set; }
    public bool Active { get; set; } = true;
    public bool Deleted { get; set; }
    public long Seq { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class Customer : SyncRow
{
    public string Name { get; set; } = "";
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Description { get; set; }
    public bool Deleted { get; set; }
    public long Seq { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class Provider : SyncRow
{
    public string Name { get; set; } = "";
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Description { get; set; }
    public bool Deleted { get; set; }
    public long Seq { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class Order : SyncRow
{
    public long Number { get; set; }
    public string Status { get; set; } = OrderStatus.Pending;
    public string? PrepStatus { get; set; }
    public string? OrderType { get; set; }
    public string? WaiterId { get; set; }
    public string? WaiterName { get; set; }
    public string? TableId { get; set; }
    public string? TableName { get; set; }
    public string? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public string? CustomerPhone { get; set; }
    public string? CustomerAddress { get; set; }
    public string? CustomerDescription { get; set; }
    public long TotalCents { get; set; }
    public long ReceivedCents { get; set; }
    public long ChangeCents { get; set; }
    public string? PaymentMethod { get; set; }
    public string ItemsJson { get; set; } = "[]";
    public string EventsJson { get; set; } = "[]";
    public bool Overventa { get; set; }
    public bool Deleted { get; set; }
    public long Seq { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset PaidAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? KitchenTicketId { get; set; }
}

public sealed class StockMovement : SyncRow
{
    public string ProductId { get; set; } = "";
    public string MovementType { get; set; } = "";
    public long Quantity { get; set; }
    public long? AmountCents { get; set; }
    public string? OrderId { get; set; }
    public string? DeviceId { get; set; }
    public long Seq { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class CashRegister : SyncRow
{
    public long OpeningAmountCents { get; set; }
    public DateTimeOffset OpenedAt { get; set; } = DateTimeOffset.UtcNow;
    public string State { get; set; } = "open";
}

public sealed class CashClosure : SyncRow
{
    public string RegisterId { get; set; } = "";
    public long OpeningAmountCents { get; set; }
    public long ExpectedCents { get; set; }
    public long ClosingAmountCents { get; set; }
    public long DifferenceCents { get; set; }
    public string SalesByMethodJson { get; set; } = "{}";
    public bool Overventa { get; set; }
    public long Seq { get; set; }
    public DateTimeOffset OpenedAt { get; set; }
    public DateTimeOffset ClosedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class Backup
{
    public string Id { get; set; } = "";
    public string BusinessId { get; set; } = "";
    public string PayloadJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}