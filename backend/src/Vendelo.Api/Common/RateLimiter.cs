using System.Collections.Concurrent;

namespace Vendelo.Api.Common;

/// Fixed-window, in-memory rate limiter (single instance). Distributed store/depuración de buckets
/// pertenecen al despliegue (F5); ver INFORME-F3.1. El bucket principal es por clave (IP,
/// cuenta, dispositivo) con presupuesto y ventana definidos por llamada.
public sealed class RateLimiter
{
    private sealed record Bucket(DateTimeOffset WindowStart, int Count);

    private readonly ConcurrentDictionary<string, Bucket> _buckets = new(StringComparer.Ordinal);

    /// Consumes one credit for `key` within the window. Returns 0 when allowed,
    /// otherwise the number of seconds to wait before retrying.
    public int Consume(string key, int max, TimeSpan window)
    {
        var now = DateTimeOffset.UtcNow;
        while (true)
        {
            var bucket = _buckets.GetOrAdd(key, _ => new Bucket(now, 0));
            var elapsed = now - bucket.WindowStart;
            Bucket next;
            if (elapsed >= window)
                next = new Bucket(now, 1);
            else if (bucket.Count < max)
                next = bucket with { Count = bucket.Count + 1 };
            else
                return (int)Math.Max(1, Math.Ceiling((window - elapsed).TotalSeconds));

            if (_buckets.TryUpdate(key, next, bucket)) return 0;
        }
    }

    public static void Enforce(RateLimiter limiter, string key, int max, TimeSpan window)
    {
        var wait = limiter.Consume(key, max, window);
        if (wait > 0)
            throw new AppException("RATE_LIMITED", "Demasiados intentos. Inténtalo de nuevo en un momento.", 429)
            {
                RetryAfterSeconds = wait
            };
    }
}