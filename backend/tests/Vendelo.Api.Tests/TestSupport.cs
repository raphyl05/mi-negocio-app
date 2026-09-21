using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Vendelo.Api.Common;

namespace Vendelo.Api.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string _dbPath =
        Path.Combine(Path.GetTempPath(), $"vendelo-test-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("Database:Provider", "Sqlite");
        builder.UseSetting("ConnectionStrings:Vendelo", $"DataSource={_dbPath}");
        builder.UseSetting("Jwt:Key", "vendelo-test-key-00000000000000000000000000000000");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try { File.Delete(_dbPath); } catch { }
    }
}

public static class TestClient
{
    private static readonly JsonSerializerOptions Opts = new(JsonSerializerDefaults.Web);

    public static StringContent Json(object body) =>
        new(JsonSerializer.Serialize(body, Opts), System.Text.Encoding.UTF8, "application/json");

    public static Task<T?> ReadAs<T>(this HttpResponseMessage resp) => resp.Content.ReadFromJsonAsync<T>(Opts);

    public static async Task<JsonNode?> ReadNode(this HttpResponseMessage resp)
    {
        var text = await resp.Content.ReadAsStringAsync();
        return string.IsNullOrWhiteSpace(text) ? null : JsonNode.Parse(text);
    }
}

public sealed record Registered(string AccessToken, string RefreshToken, string UserId, string BusinessId,
    string Identifier, string Password);

public static class TestFlow
{
    public static string UniqueEmail() => $"user-{Guid.NewGuid():N}@test.local";
    public static string UniqueDevice() => $"dev-{Guid.NewGuid():N}";

    public static async Task<Registered> RegisterAsync(
        HttpClient client, string? email = null, string? phone = null, string? businessId = null,
        Dictionary<string, object?>? capabilities = null, string deviceId = "dev-test-0001")
    {
        var identifier = email ?? phone ?? UniqueEmail();
        var payload = new Dictionary<string, object?>
        {
            ["identifier"] = identifier,
            ["password"] = "TestPass123!",
            ["deviceId"] = deviceId,
            ["deviceName"] = "Device Test",
            ["name"] = "Test Owner",
            ["ownerName"] = "Test Owner",
            ["businessType"] = "COMMERCE",
            ["businessId"] = businessId,
            ["capabilities"] = capabilities ?? new Dictionary<string, object?>
            {
                ["restaurant"] = false, ["waiters"] = false, ["tables"] = false,
                ["kitchen"] = false, ["kitchenPrinting"] = false
            }
        };
        var resp = await client.PostAsync("/api/v1/auth/register", TestClient.Json(payload));
        resp.EnsureSuccessStatusCode();
        var login = await resp.ReadAs<LoginResponseDto>();
        return new Registered(login!.AccessToken, login.RefreshToken, login.User.Id, login.Businesses[0].Id,
            identifier, "TestPass123!");
    }

    public static async Task<LoginResponseDto> LoginAsync(HttpClient client, string identifier, string password, string deviceId)
    {
        var resp = await client.PostAsync("/api/v1/auth/login", TestClient.Json(new { identifier, password, deviceId }));
        if (!resp.IsSuccessStatusCode)
            throw new Exception($"LOGIN {resp.StatusCode}: {(await resp.ReadNode())?.ToJsonString()}");
        resp.EnsureSuccessStatusCode();
        return (await resp.ReadAs<LoginResponseDto>())!;
    }

    public static HttpRequestMessage Authorized(HttpMethod method, string url, object? body = null)
    {
        var msg = new HttpRequestMessage(method, url);
        if (body is not null) msg.Content = TestClient.Json(body);
        return msg;
    }
}