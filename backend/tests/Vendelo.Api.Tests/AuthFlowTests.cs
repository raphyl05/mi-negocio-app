using System.Net;
using System.Net.Http.Headers;
using Vendelo.Api.Auth;
using Vendelo.Api.Common;

namespace Vendelo.Api.Tests;

public sealed class AuthFlowTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public AuthFlowTests(ApiFactory factory)
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
    public async Task Register_Returns201_WithTokensAndBusiness()
    {
        var resp = await TestFlow.RegisterAsync(_client);

        Assert.False(string.IsNullOrWhiteSpace(resp.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(resp.RefreshToken));
        Assert.False(string.IsNullOrWhiteSpace(resp.BusinessId));
        Assert.False(string.IsNullOrWhiteSpace(resp.UserId));
    }

    [Fact]
    public async Task Register_DuplicateEmail_Returns409Conflict()
    {
        var email = TestFlow.UniqueEmail();
        await TestFlow.RegisterAsync(_client, email: email, deviceId: TestFlow.UniqueDevice());

        var resp = await _client.PostAsync("/api/v1/auth/register", TestClient.Json(new
        {
            identifier = email,
            password = "TestPass123!",
            deviceId = TestFlow.UniqueDevice(),
            name = "Otro Dueño",
            businessType = "COMMERCE"
        }));

        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
        var node = await resp.ReadNode();
        Assert.Equal("CONFLICT", (string?)node!["error"]!["code"]);
        Assert.False(string.IsNullOrWhiteSpace((string?)node["error"]!["requestId"] == null ? "" : "x"));
    }

    [Fact]
    public async Task Register_PhoneIdentifier_Returns201()
    {
        var r = await TestFlow.RegisterAsync(_client, phone: $"9{new Random().Next(100000000, 999999999)}",
            deviceId: TestFlow.UniqueDevice());
        Assert.False(string.IsNullOrWhiteSpace(r.BusinessId));
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        var email = TestFlow.UniqueEmail();
        await TestFlow.RegisterAsync(_client, email: email, deviceId: TestFlow.UniqueDevice());

        var resp = await _client.PostAsync("/api/v1/auth/login", TestClient.Json(new
        {
            identifier = email,
            password = "wrong-password",
            deviceId = TestFlow.UniqueDevice()
        }));

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
        var node = await resp.ReadNode();
        Assert.Equal("UNAUTHORIZED", (string?)node!["error"]!["code"]);
    }

    [Fact]
    public async Task Login_ValidCredentials_Returns200()
    {
        var email = TestFlow.UniqueEmail();
        await TestFlow.RegisterAsync(_client, email: email, deviceId: "dev-login-1");
        var resp = await _client.PostAsync("/api/v1/auth/login", TestClient.Json(new
        {
            identifier = email,
            password = "TestPass123!",
            deviceId = "dev-login-2"
        }));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var login = await resp.ReadAs<LoginResponseDto>();
        Assert.NotNull(login);
        Assert.False(string.IsNullOrWhiteSpace(login!.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(login.RefreshToken));
        Assert.Single(login.Businesses);
    }

    [Fact]
    public async Task Refresh_Rotates_AndOldRefreshBecomesInvalid()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: "dev-refresh-1");

        var first = await _client.PostAsync("/api/v1/auth/refresh", TestClient.Json(new { refreshToken = r.RefreshToken }));
        first.EnsureSuccessStatusCode();
        var pair = await first.ReadAs<LoginResponseDto>();
        Assert.NotNull(pair);
        Assert.NotEqual(r.RefreshToken, pair!.RefreshToken);

        var replay = await _client.PostAsync("/api/v1/auth/refresh", TestClient.Json(new { refreshToken = r.RefreshToken }));
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);

        var replay2 = await _client.PostAsync("/api/v1/auth/refresh", TestClient.Json(new { refreshToken = pair.RefreshToken }));
        Assert.Equal(HttpStatusCode.OK, replay2.StatusCode);
    }

    [Fact]
    public async Task Session_ValidToken_ReturnsUserAndBusinesses()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: "dev-session-1");
        var resp = await _client.SendAsync(WithToken(HttpMethod.Get, "/api/v1/auth/session", r.AccessToken));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var node = await resp.ReadNode();
        Assert.Equal(r.UserId, (string?)node!["user"]!["id"]);
        Assert.Equal(r.BusinessId, (string?)node["businesses"]![0]!["id"]);
    }

    [Fact]
    public async Task Session_WithoutToken_Returns401()
    {
        var resp = await _client.GetAsync("/api/v1/auth/session");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public void PasswordHasher_RoundTrips()
    {
        var encoded = PasswordHasher.Hash("TestPass123!");
        Assert.True(PasswordHasher.Verify("TestPass123!", encoded));
        Assert.False(PasswordHasher.Verify("wrong-password", encoded));
    }
}