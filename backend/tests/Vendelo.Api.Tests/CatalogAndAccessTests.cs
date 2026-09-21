using System.Net;
using System.Net.Http.Headers;
using Vendelo.Api.Common;

namespace Vendelo.Api.Tests;

public sealed class CatalogAndAccessTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;
    private readonly ApiFactory _factory;

    public CatalogAndAccessTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private static HttpRequestMessage With(HttpMethod method, string url, string token, object? body = null)
    {
        var msg = TestFlow.Authorized(method, url, body);
        msg.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return msg;
    }

    [Fact]
    public async Task Product_CreateUpdateDelete_Flow()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var baseUrl = $"/api/v1/businesses/{r.BusinessId}";

        var create = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/products", r.AccessToken,
            new { id = "prod-1", name = "Café", priceCents = 2500, openingStock = 12, active = true }));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var p = await create.ReadAs<ProductDto>();
        Assert.Equal("prod-1", p!.Id);
        Assert.Equal(2500, p.PriceCents);
        Assert.Equal(12, p.OpeningStock);

        var update = await _client.SendAsync(With(HttpMethod.Put, $"{baseUrl}/products/prod-1", r.AccessToken,
            new { id = "prod-1", name = "Café grande", priceCents = 3000, openingStock = 12, active = false }));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var up = await update.ReadAs<ProductDto>();
        Assert.Equal("Café grande", up!.Name);
        Assert.Equal(3000, up.PriceCents);
        Assert.False(up.Active);

        var del = await _client.SendAsync(With(HttpMethod.Delete, $"{baseUrl}/products/prod-1", r.AccessToken));
        Assert.Equal(HttpStatusCode.OK, del.StatusCode);

        var list = await _client.SendAsync(With(HttpMethod.Get, $"{baseUrl}/products", r.AccessToken));
        var arr = await list.ReadNode();
        Assert.True((bool?)arr![0]!["deleted"]);
    }

    [Fact]
    public async Task Product_DuplicateId_Returns409()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var baseUrl = $"/api/v1/businesses/{r.BusinessId}";
        var body = new { id = "prod-x", name = "Pan", priceCents = 500 };
        await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/products", r.AccessToken, body));
        var dup = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/products", r.AccessToken, body));
        Assert.Equal(HttpStatusCode.Conflict, dup.StatusCode);
    }

    [Fact]
    public async Task VERSION_MISMATCH_OnStaleCapabilityPatch()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var url = $"/api/v1/businesses/{r.BusinessId}/capabilities";

        var ok = await _client.SendAsync(With(HttpMethod.Patch, url, r.AccessToken,
            new { expectedCapabilityVersion = 1, businessType = "RESTAURANT",
                  capabilities = new Dictionary<string, object?> { ["restaurant"] = true } }));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var biz = await ok.ReadAs<BusinessDto>();
        Assert.Equal(2, biz!.CapabilityVersion);
        Assert.Equal("RESTAURANT", biz.BusinessType);

        var stale = await _client.SendAsync(With(HttpMethod.Patch, url, r.AccessToken,
            new { expectedCapabilityVersion = 1 }));
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var node = await stale.ReadNode();
        Assert.Equal("VERSION_MISMATCH", (string?)node!["error"]!["code"]);
        Assert.Equal(2, (long?)node["error"]!["details"]!["current"]);
        Assert.Equal(1, (long?)node["error"]!["details"]!["expected"]);
    }

    [Fact]
    public async Task WaiterOrder_WithoutWaitersCapability_ReturnsFEATURE_DISABLED()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var url = $"/api/v1/businesses/{r.BusinessId}/orders";

        var resp = await _client.SendAsync(With(HttpMethod.Post, url, r.AccessToken,
            new
            {
                id = $"order-{Guid.NewGuid():N}",
                orderType = "waiter",
                waiterId = "w-1",
                tableName = "Mesa 1",
                waiterName = "Juan",
                items = new[] { new { productId = "p-1", name = "Café", quantity = 1, unitPriceCents = 2500, lineTotalCents = 2500 } }
            }));

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
        var node = await resp.ReadNode();
        Assert.Equal("FEATURE_DISABLED", (string?)node!["error"]!["code"]);
    }

    [Fact]
    public async Task Restaurant_WithWaitersAndTables_AcceptsWaiterOrder()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice(),
            capabilities: new Dictionary<string, object?>
            {
                ["restaurant"] = true, ["waiters"] = true, ["tables"] = true,
                ["kitchen"] = true, ["kitchenPrinting"] = true
            });
        var url = $"/api/v1/businesses/{r.BusinessId}/orders";

        var noWaitress = await _client.SendAsync(With(HttpMethod.Post, url, r.AccessToken,
            new { id = $"order-{Guid.NewGuid():N}", orderType = "waiter",
                  items = new[] { new { productId = "p-1", name = "Pan", quantity = 1, unitPriceCents = 500, lineTotalCents = 500 } } }));
        Assert.Equal(HttpStatusCode.BadRequest, noWaitress.StatusCode);
        var errorNode = await noWaitress.ReadNode();
        Assert.Equal("anonymous_order", (string?)errorNode!["error"]!["code"]);

        var ok = await _client.SendAsync(With(HttpMethod.Post, url, r.AccessToken,
            new { id = $"order-{Guid.NewGuid():N}", orderType = "waiter", waiterId = "w-1", waiterName = "Juan",
                  tableName = "Mesa 2",
                  items = new[] { new { productId = "p-1", name = "Pan", quantity = 1, unitPriceCents = 500, lineTotalCents = 500 } } }));
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
    }

    [Fact]
    public async Task DeviceRoleLowersEffectiveRole_WaiterCannotEditProducts()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: "owner-device");
        var reg = await _client.SendAsync(With(HttpMethod.Post, "/api/v1/devices", r.AccessToken,
            new { businessId = r.BusinessId, deviceId = "waiter-device", deviceName = "Waiter", role = "waiter" }));
        Assert.Equal(HttpStatusCode.Created, reg.StatusCode);

        var waiterLogin = await TestFlow.LoginAsync(_client, r.Identifier, r.Password, "waiter-device");
        var baseUrl = $"/api/v1/businesses/{r.BusinessId}";

        // Waiter no tiene products.crud -> 403
        var denied = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/products", waiterLogin.AccessToken,
            new { id = "p-w", name = "Pan", priceCents = 500 }));
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);

        // Waiter sí tiene orders.create -> POS order 201
        var ok = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/orders", waiterLogin.AccessToken,
            new { id = $"order-{Guid.NewGuid():N}", items = new[] { new { productId = "p-w", name = "Pan", quantity = 1, unitPriceCents = 500, lineTotalCents = 500 } } }));
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
    }

    [Fact]
    public async Task Cashier_CanCreateOrdersButCannotPatchCapabilities()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: "owner-device-2");
        await _client.SendAsync(With(HttpMethod.Post, "/api/v1/devices", r.AccessToken,
            new { businessId = r.BusinessId, deviceId = "cashier-device", deviceName = "Caja", role = "cashier" }));

        var login = await TestFlow.LoginAsync(_client, r.Identifier, r.Password, "cashier-device");
        var baseUrl = $"/api/v1/businesses/{r.BusinessId}";

        var denied = await _client.SendAsync(With(HttpMethod.Patch, $"{baseUrl}/capabilities", login.AccessToken,
            new { expectedCapabilityVersion = 1, businessType = "RESTAURANT" }));
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);

        var ok = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/orders", login.AccessToken,
            new { id = $"order-{Guid.NewGuid():N}", items = new[] { new { productId = "p-c", name = "Refresco", quantity = 1, unitPriceCents = 1500, lineTotalCents = 1500 } } }));
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
    }
}