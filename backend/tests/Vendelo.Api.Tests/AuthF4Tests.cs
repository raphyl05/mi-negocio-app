using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using Vendelo.Api.Auth;
using Vendelo.Api.Common;

namespace Vendelo.Api.Tests;

public sealed class AuthF4Tests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public AuthF4Tests(ApiFactory factory)
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
    public async Task Me_ReturnsProfileAndMemberships()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: "dev-f4-me");
        var resp = await _client.SendAsync(WithToken(HttpMethod.Get, "/api/v1/auth/me", r.AccessToken));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var node = await resp.ReadNode();
        Assert.Equal(r.UserId, (string?)node!["user"]!["id"]);
        Assert.Equal(r.BusinessId, (string?)node["businesses"]![0]!["id"]);
        Assert.Equal("", (string?)node["accessToken"]);
        Assert.Equal("", (string?)node["refreshToken"]);
    }

    [Fact]
    public async Task Me_WithoutToken_Returns401()
    {
        var resp = await _client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Logout_RevokesRefresh_Returns204()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: "dev-f4-logout");
        var resp = await _client.PostAsync("/api/v1/auth/logout", TestClient.Json(new { refreshToken = r.RefreshToken }));
        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);

        var replay = await _client.PostAsync("/api/v1/auth/refresh", TestClient.Json(new { refreshToken = r.RefreshToken }));
        Assert.Equal(HttpStatusCode.Conflict, replay.StatusCode);
        var node = await replay.ReadNode();
        Assert.Equal("TOKEN_REUSE", (string?)node!["error"]!["code"]);
    }

    [Fact]
    public async Task Logout_UnknownRefresh_StillReturns204()
    {
        var resp = await _client.PostAsync("/api/v1/auth/logout", TestClient.Json(new { refreshToken = "no-such-token" }));
        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);
    }

    [Fact]
    public async Task ChangePassword_RevokesOldSessionsAndCredentials()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: "dev-f4-cp");

        var change = await _client.SendAsync(WithToken(HttpMethod.Post, "/api/v1/auth/change-password", r.AccessToken, new
        {
            currentPassword = r.Password,
            newPassword = "NewPass456!"
        }));
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        // El access token anterior queda revocado por changeEpoch.
        var oldToken = await _client.SendAsync(WithToken(HttpMethod.Get, "/api/v1/auth/me", r.AccessToken));
        Assert.Equal(HttpStatusCode.Unauthorized, oldToken.StatusCode);

        // La contraseña anterior ya no vale y la nueva sí.
        var oldLogin = await _client.PostAsync("/api/v1/auth/login", TestClient.Json(new
        {
            identifier = r.Identifier,
            password = r.Password,
            deviceId = TestFlow.UniqueDevice()
        }));
        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);

        var newLogin = await _client.PostAsync("/api/v1/auth/login", TestClient.Json(new
        {
            identifier = r.Identifier,
            password = "NewPass456!",
            deviceId = TestFlow.UniqueDevice()
        }));
        Assert.Equal(HttpStatusCode.OK, newLogin.StatusCode);
    }

    [Fact]
    public async Task ChangePassword_WrongCurrent_Returns400()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: "dev-f4-cp-wrong");

        var change = await _client.SendAsync(WithToken(HttpMethod.Post, "/api/v1/auth/change-password", r.AccessToken, new
        {
            currentPassword = "wrong-password",
            newPassword = "NewPass456!"
        }));

        Assert.Equal(HttpStatusCode.BadRequest, change.StatusCode);
        var node = await change.ReadNode();
        Assert.Equal("INVALID_PASSWORD", (string?)node!["error"]!["code"]);
    }

    [Fact]
    public async Task ChangePassword_WithoutToken_Returns401()
    {
        var resp = await _client.PostAsync("/api/v1/auth/change-password",
            TestClient.Json(new { currentPassword = "x", newPassword = "y" }));
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Refresh_AfterChangePassword_IsRevoked()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: "dev-f4-cp-rev");

        var change = await _client.SendAsync(WithToken(HttpMethod.Post, "/api/v1/auth/change-password", r.AccessToken, new
        {
            currentPassword = r.Password,
            newPassword = "NewPass456!"
        }));
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        var refresh = await _client.PostAsync("/api/v1/auth/refresh", TestClient.Json(new { refreshToken = r.RefreshToken }));
        Assert.Equal(HttpStatusCode.Conflict, refresh.StatusCode);
    }

    [Fact]
    public async Task RateLimit_Login_Returns429WithRetryAfter()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: "dev-f4-rl");

        HttpResponseMessage last = null!;
        for (var i = 0; i < 12; i++)
        {
            last = await _client.PostAsync("/api/v1/auth/login", TestClient.Json(new
            {
                identifier = r.Identifier,
                password = "wrong-password",
                deviceId = $"dev-rl-{i}"
            }));
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, last.StatusCode);
        var node = await last.ReadNode();
        Assert.Equal("RATE_LIMITED", (string?)node!["error"]!["code"]);
        Assert.True(last.Headers.TryGetValues("Retry-After", out var retry));
        Assert.True(int.TryParse(retry.First(), out var seconds) && seconds > 0);
    }

    [Fact]
    public async Task AccessToken_ContainsCepAndJtiClaims()
    {
        var r = await TestFlow.RegisterAsync(_client, deviceId: "dev-f4-claims");
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(r.AccessToken);

        var jti = jwt.Claims.FirstOrDefault(c => c.Type == "jti" && !string.IsNullOrWhiteSpace(c.Value));
        Assert.NotNull(jti);

        var cep = jwt.Claims.FirstOrDefault(c => c.Type == "cep");
        Assert.NotNull(cep);
        Assert.True(long.TryParse(cep!.Value, out var epoch) && epoch > 0);
    }
}