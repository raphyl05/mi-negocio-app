using System.Text.Json.Serialization;
using Vendelo.Api.Data;

namespace Vendelo.Api.Common;

public static class EnvelopeHelper
{
    public static object Error(string code, string message, string requestId, object? details = null) => new
    {
        error = new { code, message, requestId, details }
    };
}

public sealed class ApiErrorHandlingMiddleware(RequestDelegate next, ILogger<ApiErrorHandlingMiddleware> log)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (AppException ex)
        {
            ctx.Response.StatusCode = ex.Status;
            if (ex.RetryAfterSeconds is int retryAfter)
                ctx.Response.Headers["Retry-After"] = retryAfter.ToString();
            await Write(ctx, ex.Code, ex.Message, ex.Details);
        }
        catch (Exception ex)
        {
            ctx.Response.StatusCode = 500;
            await Write(ctx, "INTERNAL_ERROR", "Ocurrió un error interno.", null);
            log.LogError(ex, "INTERNAL_ERROR {method} {path} {requestId}",
                ctx.Request.Method, ctx.Request.Path,
                ctx.Request.Headers.TryGetValue("X-Request-Id", out var rid) ? rid.ToString() : "");
        }
    }

    private static async Task Write(HttpContext ctx, string code, string message, object? details)
    {
        if (!ctx.Response.HasStarted)
        {
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsJsonAsync(EnvelopeHelper.Error(code, message,
                ctx.Request.Headers.TryGetValue("X-Request-Id", out var rid) ? rid.ToString() : "", details));
        }
    }
}

#region Auth DTOs
public sealed class AuthUserDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("username")] public string Username { get; set; } = "";
    [JsonPropertyName("email")] public string? Email { get; set; }
    [JsonPropertyName("phone")] public string? Phone { get; set; }

    public static AuthUserDto From(User u) => new() { Id = u.Id, Username = u.Username, Email = u.Email, Phone = u.Phone };
}

public sealed class BusinessLiteDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("role")] public string Role { get; set; } = "";
    [JsonPropertyName("businessType")] public string BusinessType { get; set; } = "COMMERCE";
    [JsonPropertyName("capabilities")] public object Capabilities { get; set; } = new { };
    [JsonPropertyName("capabilityVersion")] public long CapabilityVersion { get; set; }

    public static BusinessLiteDto From(Business b, string role) => new()
    {
        Id = b.Id,
        Name = b.Name,
        Role = role,
        BusinessType = b.BusinessType,
        Capabilities = b.Capabilities,
        CapabilityVersion = b.CapabilityVersion
    };
}

public sealed class LoginResponseDto
{
    [JsonPropertyName("accessToken")] public string AccessToken { get; set; } = "";
    [JsonPropertyName("refreshToken")] public string RefreshToken { get; set; } = "";
    [JsonPropertyName("user")] public AuthUserDto User { get; set; } = new();
    [JsonPropertyName("businesses")] public List<BusinessLiteDto> Businesses { get; set; } = [];
}

public sealed class RegisterRequestDto
{
    [JsonPropertyName("identifier")] public string Identifier { get; set; } = "";
    [JsonPropertyName("password")] public string Password { get; set; } = "";
    [JsonPropertyName("deviceId")] public string DeviceId { get; set; } = "";
    [JsonPropertyName("deviceName")] public string DeviceName { get; set; } = "";
    [JsonPropertyName("businessId")] public string? BusinessId { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("ownerName")] public string? OwnerName { get; set; }
    [JsonPropertyName("businessType")] public string? BusinessType { get; set; }
    [JsonPropertyName("capabilities")] public Dictionary<string, object?>? Capabilities { get; set; }
    [JsonPropertyName("settings")] public Dictionary<string, object?>? Settings { get; set; }
    [JsonPropertyName("requestId")] public string? RequestId { get; set; }
}

public sealed class LoginRequestDto
{
    [JsonPropertyName("identifier")] public string Identifier { get; set; } = "";
    [JsonPropertyName("password")] public string Password { get; set; } = "";
    [JsonPropertyName("deviceId")] public string? DeviceId { get; set; }
    [JsonPropertyName("deviceName")] public string? DeviceName { get; set; }
}

public sealed class RefreshRequestDto
{
    [JsonPropertyName("refreshToken")] public string RefreshToken { get; set; } = "";
    [JsonPropertyName("deviceId")] public string? DeviceId { get; set; }
}

public sealed class LogoutRequestDto
{
    [JsonPropertyName("refreshToken")] public string RefreshToken { get; set; } = "";
}

public sealed class ChangePasswordRequestDto
{
    [JsonPropertyName("currentPassword")] public string CurrentPassword { get; set; } = "";
    [JsonPropertyName("newPassword")] public string NewPassword { get; set; } = "";
}

public sealed class MembershipDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("businessId")] public string BusinessId { get; set; } = "";
    [JsonPropertyName("userId")] public string UserId { get; set; } = "";
    [JsonPropertyName("role")] public string Role { get; set; } = "";
}
#endregion

#region Business DTOs
public sealed class BusinessDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("ownerName")] public string? OwnerName { get; set; }
    [JsonPropertyName("businessType")] public string BusinessType { get; set; } = "COMMERCE";
    [JsonPropertyName("capabilities")] public object Capabilities { get; set; } = new { };
    [JsonPropertyName("settings")] public object Settings { get; set; } = new { };
    [JsonPropertyName("capabilityVersion")] public long CapabilityVersion { get; set; }
    [JsonPropertyName("createdAt")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updatedAt")] public string UpdatedAt { get; set; } = "";

    public static BusinessDto From(Business b) => new()
    {
        Id = b.Id,
        Name = b.Name,
        OwnerName = b.OwnerName,
        BusinessType = b.BusinessType,
        Capabilities = b.Capabilities,
        Settings = b.Settings,
        CapabilityVersion = b.CapabilityVersion,
        CreatedAt = b.CreatedAt.ToString("O"),
        UpdatedAt = b.UpdatedAt.ToString("O")
    };
}

public sealed class CreateBusinessRequestDto
{
    [JsonPropertyName("businessId")] public string? BusinessId { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("ownerName")] public string? OwnerName { get; set; }
    [JsonPropertyName("businessType")] public string? BusinessType { get; set; }
    [JsonPropertyName("capabilities")] public Dictionary<string, object?>? Capabilities { get; set; }
    [JsonPropertyName("settings")] public Dictionary<string, object?>? Settings { get; set; }
}

public sealed class CreateBusinessResponseDto
{
    [JsonPropertyName("business")] public BusinessDto Business { get; set; } = new();
    [JsonPropertyName("membership")] public MembershipDto Membership { get; set; } = new();
}

public sealed class PatchCapabilitiesRequestDto
{
    [JsonPropertyName("expectedCapabilityVersion")] public long? ExpectedCapabilityVersion { get; set; }
    [JsonPropertyName("businessType")] public string? BusinessType { get; set; }
    [JsonPropertyName("capabilities")] public Dictionary<string, object?>? Capabilities { get; set; }
    [JsonPropertyName("settings")] public Dictionary<string, object?>? Settings { get; set; }
}
#endregion

#region Catalog DTOs
public sealed class ProductDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("businessId")] public string BusinessId { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("priceCents")] public long PriceCents { get; set; }
    [JsonPropertyName("openingStock")] public long OpeningStock { get; set; }
    [JsonPropertyName("active")] public bool Active { get; set; } = true;
    [JsonPropertyName("seq")] public long Seq { get; set; }
    [JsonPropertyName("deleted")] public bool Deleted { get; set; }
    [JsonPropertyName("createdAt")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updatedAt")] public string UpdatedAt { get; set; } = "";

    public static ProductDto From(Product p) => new()
    {
        Id = p.Id, BusinessId = p.BusinessId, Name = p.Name, PriceCents = p.PriceCents,
        OpeningStock = p.OpeningStock, Active = p.Active, Seq = p.Seq, Deleted = p.Deleted,
        CreatedAt = p.CreatedAt.ToString("O"), UpdatedAt = p.UpdatedAt.ToString("O")
    };
}

public sealed class ProductRequestDto
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("priceCents")] public long PriceCents { get; set; }
    [JsonPropertyName("openingStock")] public long? OpeningStock { get; set; }
    [JsonPropertyName("active")] public bool? Active { get; set; }
}

public sealed class NamedEntityDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("businessId")] public string BusinessId { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("phone")] public string? Phone { get; set; }
    [JsonPropertyName("address")] public string? Address { get; set; }
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("seq")] public long Seq { get; set; }
    [JsonPropertyName("deleted")] public bool Deleted { get; set; }
    [JsonPropertyName("createdAt")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("updatedAt")] public string UpdatedAt { get; set; } = "";

    public static NamedEntityDto From(Customer c) => new()
    {
        Id = c.Id, BusinessId = c.BusinessId, Name = c.Name, Phone = c.Phone, Address = c.Address,
        Description = c.Description, Seq = c.Seq, Deleted = c.Deleted,
        CreatedAt = c.CreatedAt.ToString("O"), UpdatedAt = c.UpdatedAt.ToString("O")
    };

    public static NamedEntityDto From(Provider p) => new()
    {
        Id = p.Id, BusinessId = p.BusinessId, Name = p.Name, Phone = p.Phone, Address = p.Address,
        Description = p.Description, Seq = p.Seq, Deleted = p.Deleted,
        CreatedAt = p.CreatedAt.ToString("O"), UpdatedAt = p.UpdatedAt.ToString("O")
    };
}

public sealed class NamedEntityRequestDto
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("phone")] public string? Phone { get; set; }
    [JsonPropertyName("address")] public string? Address { get; set; }
    [JsonPropertyName("description")] public string? Description { get; set; }
}
#endregion

#region Order / Inventory / Cash DTOs
public sealed class OrderDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("businessId")] public string BusinessId { get; set; } = "";
    [JsonPropertyName("number")] public long Number { get; set; }
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
    [JsonPropertyName("items")] public object Items { get; set; } = new { };
    [JsonPropertyName("events")] public object Events { get; set; } = new { };
    [JsonPropertyName("totalCents")] public long TotalCents { get; set; }
    [JsonPropertyName("receivedCents")] public long ReceivedCents { get; set; }
    [JsonPropertyName("changeCents")] public long ChangeCents { get; set; }
    [JsonPropertyName("paymentMethod")] public string? PaymentMethod { get; set; }
    [JsonPropertyName("overventa")] public bool Overventa { get; set; }
    [JsonPropertyName("kitchenTicketId")] public string? KitchenTicketId { get; set; }
    [JsonPropertyName("seq")] public long Seq { get; set; }
    [JsonPropertyName("deleted")] public bool Deleted { get; set; }
    [JsonPropertyName("createdAt")] public string CreatedAt { get; set; } = "";
    [JsonPropertyName("paidAt")] public string? PaidAt { get; set; }
    [JsonPropertyName("updatedAt")] public string UpdatedAt { get; set; } = "";

    public static OrderDto From(Order o) => new()
    {
        Id = o.Id, BusinessId = o.BusinessId, Number = o.Number, Status = o.Status,
        PrepStatus = o.PrepStatus, OrderType = o.OrderType, WaiterId = o.WaiterId,
        WaiterName = o.WaiterName, TableId = o.TableId, TableName = o.TableName,
        CustomerId = o.CustomerId, CustomerName = o.CustomerName, CustomerPhone = o.CustomerPhone,
        CustomerAddress = o.CustomerAddress, CustomerDescription = o.CustomerDescription,
        Items = Json.Des<object>(o.ItemsJson) ?? new { }, Events = Json.Des<object>(o.EventsJson) ?? new { },
        TotalCents = o.TotalCents, ReceivedCents = o.ReceivedCents, ChangeCents = o.ChangeCents,
        PaymentMethod = o.PaymentMethod, Overventa = o.Overventa, KitchenTicketId = o.KitchenTicketId,
        Seq = o.Seq, Deleted = o.Deleted, CreatedAt = o.CreatedAt.ToString("O"),
        PaidAt = o.PaidAt == default ? null : o.PaidAt.ToString("O"),
        UpdatedAt = o.UpdatedAt.ToString("O")
    };
}

public sealed class OrderRequestDto
{
    [JsonPropertyName("id")] public string? Id { get; set; }
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
    [JsonPropertyName("prepStatus")] public string? PrepStatus { get; set; }
    [JsonPropertyName("items")] public List<OrderItemDto> Items { get; set; } = [];
}

public sealed class OrderItemDto
{
    [JsonPropertyName("productId")] public string ProductId { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("quantity")] public long Quantity { get; set; }
    [JsonPropertyName("unitPriceCents")] public long UnitPriceCents { get; set; }
    [JsonPropertyName("lineTotalCents")] public long LineTotalCents { get; set; }
}

public sealed class PayOrderRequestDto
{
    [JsonPropertyName("receivedCents")] public long ReceivedCents { get; set; }
    [JsonPropertyName("paymentMethod")] public string PaymentMethod { get; set; } = "cash";
}

public sealed class PayOrderResponseDto
{
    [JsonPropertyName("order")] public OrderDto Order { get; set; } = new();
    [JsonPropertyName("invoiceNumber")] public long InvoiceNumber { get; set; }
    [JsonPropertyName("overventa")] public bool Overventa { get; set; }
}

public sealed class StockMovementDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("businessId")] public string BusinessId { get; set; } = "";
    [JsonPropertyName("productId")] public string ProductId { get; set; } = "";
    [JsonPropertyName("movementType")] public string MovementType { get; set; } = "";
    [JsonPropertyName("quantity")] public long Quantity { get; set; }
    [JsonPropertyName("amountCents")] public long? AmountCents { get; set; }
    [JsonPropertyName("orderId")] public string? OrderId { get; set; }
    [JsonPropertyName("deviceId")] public string? DeviceId { get; set; }
    [JsonPropertyName("seq")] public long Seq { get; set; }
    [JsonPropertyName("createdAt")] public string CreatedAt { get; set; } = "";

    public static StockMovementDto From(StockMovement m) => new()
    {
        Id = m.Id, BusinessId = m.BusinessId, ProductId = m.ProductId, MovementType = m.MovementType,
        Quantity = m.Quantity, AmountCents = m.AmountCents, OrderId = m.OrderId, DeviceId = m.DeviceId,
        Seq = m.Seq, CreatedAt = m.CreatedAt.ToString("O")
    };
}

public sealed class StockAdjustRequestDto
{
    [JsonPropertyName("movementType")] public string MovementType { get; set; } = "purchase";
    [JsonPropertyName("quantity")] public long Quantity { get; set; }
    [JsonPropertyName("amountCents")] public long? AmountCents { get; set; }
    [JsonPropertyName("note")] public string? Note { get; set; }
}

public sealed class CashOpenRequestDto
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("openingAmountCents")] public long OpeningAmountCents { get; set; }
}

public sealed class CashCloseRequestDto
{
    [JsonPropertyName("closingAmountCents")] public long ClosingAmountCents { get; set; }
}

public sealed class CashClosureDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("businessId")] public string BusinessId { get; set; } = "";
    [JsonPropertyName("registerId")] public string RegisterId { get; set; } = "";
    [JsonPropertyName("openingAmountCents")] public long OpeningAmountCents { get; set; }
    [JsonPropertyName("expectedCents")] public long ExpectedCents { get; set; }
    [JsonPropertyName("closingAmountCents")] public long ClosingAmountCents { get; set; }
    [JsonPropertyName("differenceCents")] public long DifferenceCents { get; set; }
    [JsonPropertyName("salesByMethod")] public object SalesByMethod { get; set; } = new { };
    [JsonPropertyName("overventa")] public bool Overventa { get; set; }
    [JsonPropertyName("seq")] public long Seq { get; set; }
    [JsonPropertyName("openedAt")] public string OpenedAt { get; set; } = "";
    [JsonPropertyName("closedAt")] public string ClosedAt { get; set; } = "";

    public static CashClosureDto From(CashClosure c) => new()
    {
        Id = c.Id, BusinessId = c.BusinessId, RegisterId = c.RegisterId,
        OpeningAmountCents = c.OpeningAmountCents, ExpectedCents = c.ExpectedCents,
        ClosingAmountCents = c.ClosingAmountCents, DifferenceCents = c.DifferenceCents,
        SalesByMethod = Json.Des<object>(c.SalesByMethodJson) ?? new { }, Overventa = c.Overventa,
        Seq = c.Seq, OpenedAt = c.OpenedAt.ToString("O"), ClosedAt = c.ClosedAt.ToString("O")
    };
}
#endregion

#region Sync DTOs
public sealed class SyncChangesDto
{
    [JsonPropertyName("business")] public object? Business { get; set; }
    [JsonPropertyName("products")] public List<ProductDto> Products { get; set; } = [];
    [JsonPropertyName("customers")] public List<NamedEntityDto> Customers { get; set; } = [];
    [JsonPropertyName("providers")] public List<NamedEntityDto> Providers { get; set; } = [];
    [JsonPropertyName("orders")] public List<OrderDto> Orders { get; set; } = [];
    [JsonPropertyName("stockMovements")] public List<StockMovementDto> StockMovements { get; set; } = [];
    [JsonPropertyName("cashClosures")] public List<CashClosureDto> CashClosures { get; set; } = [];
}

public sealed class PullResponseDto
{
    [JsonPropertyName("cursor")] public string Cursor { get; set; } = "";
    [JsonPropertyName("nextCursor")] public string? NextCursor { get; set; }
    [JsonPropertyName("hasMore")] public bool HasMore { get; set; }
    [JsonPropertyName("serverTime")] public string ServerTime { get; set; } = "";
    [JsonPropertyName("changes")] public SyncChangesDto Changes { get; set; } = new();
}

public sealed class PushRequestDto
{
    [JsonPropertyName("requestId")] public string RequestId { get; set; } = "";
    [JsonPropertyName("opType")] public string OpType { get; set; } = "incremental";
    [JsonPropertyName("batches")] public List<PushBatchDto> Batches { get; set; } = [];
}

public sealed class PushBatchDto
{
    [JsonPropertyName("entityType")] public string EntityType { get; set; } = "";
    [JsonPropertyName("action")] public string Action { get; set; } = "upsert";
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("entity")] public object? Entity { get; set; }
}

public sealed class PushResponseDto
{
    [JsonPropertyName("requestId")] public string RequestId { get; set; } = "";
    [JsonPropertyName("applied")] public bool Applied { get; set; }
    [JsonPropertyName("duplicate")] public bool Duplicate { get; set; }
    [JsonPropertyName("seq")] public long Seq { get; set; }
    [JsonPropertyName("accepted")] public int Accepted { get; set; }
    [JsonPropertyName("rejected")] public int Rejected { get; set; }
}
#endregion