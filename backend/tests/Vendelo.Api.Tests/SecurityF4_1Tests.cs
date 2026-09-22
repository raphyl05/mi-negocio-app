using System.Net;
using System.Net.Http.Headers;
using Vendelo.Api.Common;

namespace Vendelo.Api.Tests;

public sealed class SecurityF4_1Tests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public SecurityF4_1Tests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    private static HttpRequestMessage WithToken(HttpMethod method, string url, string token, object? body = null)
    {
        var msg = TestFlow.Authorized(method, url, body);
        msg.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return msg;
    }

    [Fact]
    public async Task CrossBusiness_AccessWithAnotherToken_Returns404()
    {
        var a = await TestFlow.RegisterAsync(_client, deviceId: "dev-f41-a");
        var b = await TestFlow.RegisterAsync(_client, deviceId: "dev-f41-b");

        // Lectura de negocio ajeno
        Assert.Equal(HttpStatusCode.NotFound, (await _client.SendAsync(WithToken(HttpMethod.Get, $"/api/v1/businesses/{b.BusinessId}", a.AccessToken))).StatusCode);
        // Catálogo de negocio ajeno (unitario )
        Assert.Equal(HttpStatusCode.NotFound, (await _client.SendAsync(WithToken(HttpMethod.Get, $"/api/v1/businesses/{b.BusinessId}/products", a.AccessToken))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.SendAsync(WithToken(HttpMethod.Get, $"/api/v1/businesses/{b.BusinessId}/customers", a.AccessToken))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.SendAsync(WithToken(HttpMethod.Get, $"/api/v1/businesses/{b.BusinessId}/devices", a.AccessToken))).StatusCode);
        // Escritura en negocio ajeno
        Assert.Equal(HttpStatusCode.NotFound, (await _client.SendAsync(WithToken(HttpMethod.Post, $"/api/v1/businesses/{b.BusinessId}/products", a.AccessToken, new { name = "Hack", priceCents = 1 }))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.SendAsync(WithToken(HttpMethod.Get, $"/api/v1/businesses/{b.BusinessId}/sync/pull", a.AccessToken))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.SendAsync(WithToken(HttpMethod.Post, $"/api/v1/businesses/{b.BusinessId}/sync/push", a.AccessToken,
            new { requestId = "req-f41-00001", opType = "incremental", batches = new object[] { } }))).StatusCode);
    }

    [Fact]
    public async Task CrossBusiness_EntityIdInAnotherBusiness_Returns404()
    {
        var a = await TestFlow.RegisterAsync(_client, deviceId: "dev-f41-a2");
        var b = await TestFlow.RegisterAsync(_client, deviceId: "dev-f41-b2");

        // A crea un producto con id conocido en su negocio.
        var create = await _client.SendAsync(WithToken(HttpMethod.Post, $"/api/v1/businesses/{a.BusinessId}/products", a.AccessToken,
            new { id = "shared-prod", name = "Compartido", priceCents = 500 }));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        // B no puede actualizarlo ni eliminarlo aunque conozca el id.
        var upd = await _client.SendAsync(WithToken(HttpMethod.Put, $"/api/v1/businesses/{a.BusinessId}/products/shared-prod", b.AccessToken,
            new { priceCents = 9000 }));
        Assert.Equal(HttpStatusCode.NotFound, upd.StatusCode);
        var del = await _client.SendAsync(WithToken(HttpMethod.Delete, $"/api/v1/businesses/{a.BusinessId}/products/shared-prod", b.AccessToken));
        Assert.Equal(HttpStatusCode.NotFound, del.StatusCode);

        // Y A aún ve su producto intacto en su negocio.
        var list = await _client.SendAsync(WithToken(HttpMethod.Get, $"/api/v1/businesses/{a.BusinessId}/products", a.AccessToken));
        list.EnsureSuccessStatusCode();
        var node = await list.ReadNode();
        Assert.Equal("shared-prod", (string?)node![0]!["id"]);
    }

    [Fact]
    public void RateLimiter_Consume_EnforcesBudgetWithinWindow()
    {
        var l = new RateLimiter();
        var w = TimeSpan.FromMinutes(1);
        var allowed = 0;
        for (var i = 0; i < 5; i++)
            if (l.Consume("k", 3, w) == 0) allowed++;
        Assert.Equal(3, allowed);
        Assert.True(l.Consume("k", 3, w) > 0);
    }

    [Fact]
    public void RateLimiter_Enforce_Throws429WithRetryAfter()
    {
        var l = new RateLimiter();
        var w = TimeSpan.FromMinutes(1);
        Assert.Equal(0, l.Consume("k", 1, w));
        var ex = Assert.Throws<AppException>(() => RateLimiter.Enforce(l, "k", 1, w));
        Assert.Equal(429, ex.Status);
        Assert.True(ex.RetryAfterSeconds is int r && r > 0);
    }
}