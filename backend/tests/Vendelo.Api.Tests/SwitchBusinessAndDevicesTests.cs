using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Vendelo.Api.Common;

namespace Vendelo.Api.Tests;

public sealed class SwitchBusinessAndDevicesTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public SwitchBusinessAndDevicesTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    private HttpRequestMessage WithToken(HttpMethod method, string url, string token, object? body = null)
    {
        var msg = TestFlow.Authorized(method, url, body);
        msg.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return msg;
    }

    [Fact]
    public async Task Login_WithDeviceRole_SetsDeviceRole()
    {
        var r = await TestFlow.RegisterAsync(_client);

        var loginResp = await _client.PostAsync("/api/v1/auth/login", TestClient.Json(new
        {
            identifier = r.Identifier,
            password = r.Password,
            deviceId = r.BusinessId + "-dev2",
            deviceRole = "admin",
        }));
        loginResp.EnsureSuccessStatusCode();
        var login = await loginResp.ReadAs<LoginResponseDto>();
        Assert.False(string.IsNullOrWhiteSpace(login!.AccessToken));

        var list = await _client.SendAsync(WithToken(HttpMethod.Get,
            $"/api/v1/businesses/{r.BusinessId}/devices", login.AccessToken));
        list.EnsureSuccessStatusCode();
        var devices = await list.ReadAs<System.Collections.Generic.List<DeviceDto>>();
        Assert.NotNull(devices);
        Assert.Contains(devices!, d => d.Id == r.BusinessId + "-dev2" && d.Role == "admin");
    }

    [Fact]
    public async Task SwitchBusiness_UsesSelectedMembership_AndReturnsNewTokens()
    {
        var r = await TestFlow.RegisterAsync(_client);

        var create = await _client.SendAsync(WithToken(HttpMethod.Post, "/api/v1/businesses", r.AccessToken,
            new { name = "Segundo Negocio", businessType = "COMMERCE" }));
        create.EnsureSuccessStatusCode();
        var created = await create.ReadNode();
        var secondBusinessId = (string?)created!["membership"]!["businessId"];
        Assert.False(string.IsNullOrWhiteSpace(secondBusinessId));

        var switchResp = await _client.SendAsync(WithToken(HttpMethod.Post, "/api/v1/auth/switch-business",
            r.AccessToken, new { businessId = secondBusinessId }));
        Assert.Equal(HttpStatusCode.OK, switchResp.StatusCode);
        var switched = await switchResp.ReadAs<LoginResponseDto>();
        Assert.NotNull(switched);
        Assert.False(string.IsNullOrWhiteSpace(switched!.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(switched.RefreshToken));
        Assert.Contains(switched.Businesses, b => b.Id == secondBusinessId);
        Assert.Equal("owner", switched.Businesses.FirstOrDefault(b => b.Id == secondBusinessId)?.Role);

        var session = await _client.SendAsync(WithToken(HttpMethod.Get, "/api/v1/auth/session", switched.AccessToken));
        session.EnsureSuccessStatusCode();
        var sessionBody = await session.ReadAs<LoginResponseDto>();
        Assert.Equal(2, sessionBody!.Businesses.Count);
        Assert.Contains(sessionBody.Businesses, b => b.Id == secondBusinessId);
    }

    [Fact]
    public async Task SwitchBusiness_WithoutMembership_Returns403()
    {
        var owner = await TestFlow.RegisterAsync(_client);
        var other = await TestFlow.RegisterAsync(_client);

        var resp = await _client.SendAsync(WithToken(HttpMethod.Post, "/api/v1/auth/switch-business",
            owner.AccessToken, new { businessId = other.BusinessId }));

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
        var node = await resp.ReadNode();
        Assert.Equal("FORBIDDEN", (string?)node!["error"]!["code"]);
    }

    [Fact]
    public async Task SwitchBusiness_WithoutBusinessId_Returns400()
    {
        var r = await TestFlow.RegisterAsync(_client);

        var resp = await _client.SendAsync(WithToken(HttpMethod.Post, "/api/v1/auth/switch-business",
            r.AccessToken, new { }));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }
}

public sealed class DeviceDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Role { get; set; }
    public bool Active { get; set; }
}