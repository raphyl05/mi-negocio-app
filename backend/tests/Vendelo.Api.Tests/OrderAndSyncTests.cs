using System.Net;
using System.Net.Http.Headers;
using Vendelo.Api.Common;

namespace Vendelo.Api.Tests;

public sealed class OrderAndSyncTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public OrderAndSyncTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    private static HttpRequestMessage With(HttpMethod method, string url, string token, object? body = null)
    {
        var msg = TestFlow.Authorized(method, url, body);
        msg.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return msg;
    }

    private static async Task<string> SeedProductAsync(HttpClient client, string token, string businessId,
        string productId = "cafe", string name = "Café", long priceCents = 2500, long? openingStock = 10)
    {
        var resp = await client.SendAsync(With(HttpMethod.Post, $"/api/v1/businesses/{businessId}/products", token,
            new { id = productId, name, priceCents, openingStock }));
        if (resp.StatusCode != HttpStatusCode.Created) throw new Exception(await resp.Content.ReadAsStringAsync());
        return productId;
    }

    private static object Order(string id, string productId, long qty, long price, long lineTotal) =>
        new { id, items = new[] { new { productId, name = "X", quantity = qty, unitPriceCents = price, lineTotalCents = lineTotal } } };

    [Fact]
    public async Task Order_Pay_DoublePayment_LockOnPaid()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var baseUrl = $"/api/v1/businesses/{r.BusinessId}";
        await SeedProductAsync(_client, r.AccessToken, r.BusinessId);

        var orderId = $"order-pay-{Guid.NewGuid():N}";
        var create = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/orders", r.AccessToken,
            new { id = orderId, items = new[] { new { productId = "cafe", name = "Café", quantity = 2, unitPriceCents = 2500, lineTotalCents = 5000 } } }));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var pay1 = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/orders/{orderId}/pay", r.AccessToken,
            new { receivedCents = 6000, paymentMethod = "cash" }));
        Assert.Equal(HttpStatusCode.OK, pay1.StatusCode);
        var payResp = await pay1.ReadAs<PayOrderResponseDto>();
        Assert.NotNull(payResp);
        Assert.Equal(1, payResp!.InvoiceNumber);
        Assert.True(payResp.Order.Status == "paid");

        var pay2 = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/orders/{orderId}/pay", r.AccessToken,
            new { receivedCents = 6000, paymentMethod = "cash" }));
        Assert.Equal(HttpStatusCode.Conflict, pay2.StatusCode);

        var list = await _client.SendAsync(With(HttpMethod.Get, $"{baseUrl}/orders", r.AccessToken));
        var arr = await list.ReadNode();
        Assert.Single(arr!.AsArray());
    }

    [Fact]
    public async Task Pay_Overventa_IsFlaggedButAccepted()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var baseUrl = $"/api/v1/businesses/{r.BusinessId}";
        await SeedProductAsync(_client, r.AccessToken, r.BusinessId, openingStock: 5);

        var orderId = $"order-ov-{Guid.NewGuid():N}";
        var create = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/orders", r.AccessToken,
            new { id = orderId, items = new[] { new { productId = "cafe", name = "Café", quantity = 10, unitPriceCents = 2500, lineTotalCents = 25000 } } }));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var pay = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/orders/{orderId}/pay", r.AccessToken,
            new { receivedCents = 25000, paymentMethod = "card" }));
        Assert.Equal(HttpStatusCode.OK, pay.StatusCode);
        var payResp = await pay.ReadAs<PayOrderResponseDto>();
        Assert.True(payResp!.Overventa);
    }

    [Fact]
    public async Task Void_PendingOnly_WorksButPaidRejected()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var baseUrl = $"/api/v1/businesses/{r.BusinessId}";
        await SeedProductAsync(_client, r.AccessToken, r.BusinessId);

        var orderId = $"order-void-{Guid.NewGuid():N}";
        await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/orders", r.AccessToken,
            new { id = orderId, items = new[] { new { productId = "cafe", name = "Café", quantity = 1, unitPriceCents = 2500, lineTotalCents = 2500 } } }));

        var voided = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/orders/{orderId}/void", r.AccessToken));
        Assert.Equal(HttpStatusCode.OK, voided.StatusCode);

        var again = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/orders/{orderId}/void", r.AccessToken));
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task StockAdjust_IncreasesStock()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var baseUrl = $"/api/v1/businesses/{r.BusinessId}";
        await SeedProductAsync(_client, r.AccessToken, r.BusinessId, openingStock: 0);

        var adj = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/stock/cafe/adjust", r.AccessToken,
            new { movementType = "purchase", quantity = 20, amountCents = 40000 }));
        Assert.Equal(HttpStatusCode.OK, adj.StatusCode);
        var m = await adj.ReadAs<StockMovementDto>();
        Assert.Equal(20, m!.Quantity);
        Assert.Equal("purchase", m.MovementType);
    }

    [Fact]
    public async Task CashOpenClose_ProducesClosureWithExpected()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var baseUrl = $"/api/v1/businesses/{r.BusinessId}";
        await SeedProductAsync(_client, r.AccessToken, r.BusinessId);

        var open = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/cash/open", r.AccessToken,
            new { openingAmountCents = 50000 }));
        Assert.Equal(HttpStatusCode.Created, open.StatusCode);

        var orderId = $"order-cash-{Guid.NewGuid():N}";
        await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/orders", r.AccessToken,
            new { id = orderId, items = new[] { new { productId = "cafe", name = "Café", quantity = 1, unitPriceCents = 2500, lineTotalCents = 2500 } } }));
        var pay = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/orders/{orderId}/pay", r.AccessToken,
            new { receivedCents = 2500, paymentMethod = "cash" }));
        Assert.Equal(HttpStatusCode.OK, pay.StatusCode);

        var closeResp = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/cash/close", r.AccessToken,
            new { closingAmountCents = 52500 }));
        Assert.Equal(HttpStatusCode.OK, closeResp.StatusCode);
        var closure = await closeResp.ReadAs<CashClosureDto>();
        Assert.NotNull(closure);
        Assert.Equal(50000, closure!.OpeningAmountCents);
        Assert.Equal(52500, closure.ExpectedCents);
        Assert.Equal(0, closure.DifferenceCents);

        var closures = await _client.SendAsync(With(HttpMethod.Get, $"{baseUrl}/cash/closures", r.AccessToken));
        var arr = await closures.ReadNode();
        Assert.Single(arr!.AsArray());
    }

    [Fact]
    public async Task Sync_PushProduct_ThenPull_ReturnsIt()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var url = $"/api/v1/businesses/{r.BusinessId}/sync/push";

        var push = await _client.SendAsync(With(HttpMethod.Post, url, r.AccessToken, new
        {
            requestId = $"req-{Guid.NewGuid():N}",
            opType = "initial",
            batches = new[]
            {
                new { entityType = "product", action = "upsert", id = "sync-prod-1",
                      entity = new { id = "sync-prod-1", name = "Torta", priceCents = 4500, openingStock = 3, active = true } }
            }
        }));
        Assert.Equal(HttpStatusCode.OK, push.StatusCode);
        var pushResp = await push.ReadAs<PushResponseDto>();
        Assert.NotNull(pushResp);
        Assert.Equal(1, pushResp!.Accepted);
        Assert.Equal(0, pushResp.Rejected);

        var pull = await _client.SendAsync(With(HttpMethod.Get, $"/api/v1/businesses/{r.BusinessId}/sync/pull", r.AccessToken));
        Assert.Equal(HttpStatusCode.OK, pull.StatusCode);
        var pulled = await pull.ReadAs<PullResponseDto>();
        Assert.NotNull(pulled);
        Assert.Single(pulled!.Changes.Products);
        Assert.Equal("Torta", pulled.Changes.Products[0].Name);
        Assert.NotNull(pulled.Cursor);
        Assert.StartsWith("seq:", pulled.Cursor);
    }

    [Fact]
    public async Task Sync_DuplicateRequestId_ReturnsDuplicate()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var url = $"/api/v1/businesses/{r.BusinessId}/sync/push";
        var requestId = $"req-{Guid.NewGuid():N}";
        var body = new
        {
            requestId,
            opType = "initial",
            batches = new[]
            {
                new { entityType = "product", action = "upsert", id = "dup-prod",
                      entity = new { id = "dup-prod", name = "Dup", priceCents = 100, openingStock = 0 } }
            }
        };

        var p1 = await _client.SendAsync(With(HttpMethod.Post, url, r.AccessToken, body));
        p1.EnsureSuccessStatusCode();
        var p2 = await _client.SendAsync(With(HttpMethod.Post, url, r.AccessToken, body));
        Assert.Equal(HttpStatusCode.OK, p2.StatusCode);
        var resp = await p2.ReadAs<PushResponseDto>();
        Assert.True(resp!.Duplicate);
    }

    [Fact]
    public async Task Sync_InitialOnBusinessWithData_Returns409()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var url = $"/api/v1/businesses/{r.BusinessId}/sync/push";
        var initial = new { requestId = $"req-{Guid.NewGuid():N}", opType = "initial",
                            batches = new[] { new { entityType = "product", action = "upsert", id = "p1",
                                                    entity = new { id = "p1", name = "A", priceCents = 10 } } } };
        var ok = await _client.SendAsync(With(HttpMethod.Post, url, r.AccessToken, initial));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);

        var second = new { requestId = $"req-{Guid.NewGuid():N}", opType = "initial",
                           batches = new[] { new { entityType = "product", action = "upsert", id = "p2",
                                                   entity = new { id = "p2", name = "B", priceCents = 20 } } } };
        var conflict = await _client.SendAsync(With(HttpMethod.Post, url, r.AccessToken, second));
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
        var node = await conflict.ReadNode();
        Assert.Equal("CONFLICT", (string?)node!["error"]!["code"]);
    }

    [Fact]
    public async Task Sync_PaidOrder_WithProduct_CreatesMovementsOnce()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var pushUrl = $"/api/v1/businesses/{r.BusinessId}/sync/push";
        var orderId = $"sync-order-{Guid.NewGuid():N}";
        var ridBase = $"req-{Guid.NewGuid():N}";

        var pushProduct = await _client.SendAsync(With(HttpMethod.Post, pushUrl, r.AccessToken, new
        {
            requestId = ridBase + "-prod", opType = "initial",
            batches = new[] { new { entityType = "product", action = "upsert", id = "gp",
                                     entity = new { id = "gp", name = "Gaseosa", priceCents = 2000, openingStock = 4 } } }
        }));
        pushProduct.EnsureSuccessStatusCode();

        var payBody = new
        {
            requestId = ridBase + "-paid", opType = "incremental",
            batches = new[]
            {
                new { entityType = "order", action = "upsert", id = orderId,
                      entity = new { id = orderId, status = "paid", orderType = "pos", paymentMethod = "cash",
                                     items = new[] { new { productId = "gp", name = "Gaseosa", quantity = 2, unitPriceCents = 2000, lineTotalCents = 4000 } } } }
            }
        };
        var paid = await _client.SendAsync(With(HttpMethod.Post, pushUrl, r.AccessToken, payBody));
        Assert.Equal(HttpStatusCode.OK, paid.StatusCode);

        var pull = await _client.SendAsync(With(HttpMethod.Get, $"/api/v1/businesses/{r.BusinessId}/sync/pull", r.AccessToken));
        var resp = await pull.ReadAs<PullResponseDto>();
        var sale = resp!.Changes.StockMovements.Where(s => s.MovementType == "sale").ToList();
        Assert.Single(sale);
        Assert.Equal(-2, sale[0].Quantity);

        // Reenvío del mismo pago (nuevo requestId) no duplica movimientos
        var payAgain = new { requestId = ridBase + "-paid2", opType = "incremental",
                             batches = payBody.batches };
        var paid2 = await _client.SendAsync(With(HttpMethod.Post, pushUrl, r.AccessToken, payAgain));
        paid2.EnsureSuccessStatusCode();

        var pull2 = await _client.SendAsync(With(HttpMethod.Get, $"/api/v1/businesses/{r.BusinessId}/sync/pull", r.AccessToken));
        var resp2 = await pull2.ReadAs<PullResponseDto>();
        Assert.Equal(1, resp2!.Changes.StockMovements.Count(s => s.MovementType == "sale"));
    }

    [Fact]
    public async Task Backup_RestoreFlow_RestoresProducts()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: TestFlow.UniqueDevice());
        var baseUrl = $"/api/v1/businesses/{r.BusinessId}";
        await SeedProductAsync(_client, r.AccessToken, r.BusinessId, productId: "bk-prod", name: "Original", openingStock: 7);

        var create = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/backups", r.AccessToken));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        // Mutar el negocio después del backup
        var update = await _client.SendAsync(With(HttpMethod.Put, $"{baseUrl}/products/bk-prod", r.AccessToken,
            new { id = "bk-prod", name = "Cambiado", priceCents = 9999, active = true }));
        update.EnsureSuccessStatusCode();

        var backupId = ((await create.ReadNode())!)["id"]!.GetValue<string>();
        var restore = await _client.SendAsync(With(HttpMethod.Post, $"{baseUrl}/backups/{backupId}/restore", r.AccessToken));
        Assert.Equal(HttpStatusCode.OK, restore.StatusCode);

        var list = await _client.SendAsync(With(HttpMethod.Get, $"{baseUrl}/products", r.AccessToken));
        var arr = await list.ReadNode();
        Assert.Equal("Original", (string?)arr![0]!["name"]);
    }
}