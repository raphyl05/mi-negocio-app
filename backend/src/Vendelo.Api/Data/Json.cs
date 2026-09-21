using System.Text.Json;
using System.Text.Json.Nodes;

namespace Vendelo.Api.Data;

public static class Json
{
    private static readonly JsonSerializerOptions Opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public static string Ser<T>(T value) => JsonSerializer.Serialize(value, Opts);
    public static T? Des<T>(string json) => JsonSerializer.Deserialize<T>(json, Opts);
    public static Dictionary<string, object?> DeserializeDict(string json)
    {
        try
        {
            if (JsonNode.Parse(json) is not JsonObject jo) return new Dictionary<string, object?>();
            var result = new Dictionary<string, object?>();
            foreach (var kv in jo)
                result[kv.Key] = ToClr(kv.Value);
            return result;
        }
        catch
        {
            return new Dictionary<string, object?>();
        }
    }

    private static object? ToClr(JsonNode? n) => n switch
    {
        null => null,
        JsonObject o => o.ToDictionary(p => p.Key, p => ToClr(p.Value)),
        JsonArray a => a.Select(ToClr).ToList(),
        JsonValue v when v.TryGetValue<bool>(out var b) => b,
        JsonValue v when v.TryGetValue<long>(out var l) => l,
        JsonValue v when v.TryGetValue<double>(out var d) => d,
        JsonValue v when v.TryGetValue<string>(out var s) => s,
        _ => n.ToString()
    };

    public static bool AsBool(object? v) =>
        v is bool b ? b
        : v is JsonElement je && je.ValueKind == JsonValueKind.True;
}

public static class GenId
{
    public static string New(string prefix) => $"{prefix}-{Guid.NewGuid():N}";

    public static string NewId(string? existing, string prefix)
    {
        if (string.IsNullOrWhiteSpace(existing)) return New(prefix);
        return existing.Length <= 64 ? existing : throw new AppException("VALIDATION_ERROR",
            "El id excede los 64 caracteres.", 400);
    }

    public static string UserId() => New("usr");
    public static string BusinessId() => New("business");
    public static string MembershipId() => New("membership");
    public static string DeviceSessionId() => New("sess");
}