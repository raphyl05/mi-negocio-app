using System.Collections.Concurrent;
using System.Net;
using System.Net.Mail;

namespace Vendelo.Api.Auth;

/// Códigos de recuperación en memoria (un solo uso, con expiración). En el MVP
/// es aceptable: un reinicio invalida los códigos pendientes y se pide uno nuevo.
public sealed class RecoveryCodeStore
{
    private sealed record Entry(string CodeHash, DateTimeOffset ExpiresAt, bool Used);

    private readonly ConcurrentDictionary<string, Entry> _codes = new(StringComparer.Ordinal);

    public string Issue(string userId, TimeSpan ttl)
    {
        var code = Random.Shared.Next(1_000_000, 9_999_999).ToString();
        var entry = new Entry(PasswordHasher.Sha256(code), DateTimeOffset.UtcNow + ttl, Used: false);
        _codes[userId] = entry;
        return code;
    }

    public bool VerifyAndConsume(string userId, string code)
    {
        if (string.IsNullOrWhiteSpace(code) || !_codes.TryGetValue(userId, out var entry)) return false;
        if (entry.Used || DateTimeOffset.UtcNow > entry.ExpiresAt) return false;
        if (!PasswordHasher.VerifyConstantTime(entry.CodeHash, PasswordHasher.Sha256(code))) return false;
        _codes[userId] = entry with { Used = true };
        return true;
    }
}

/// Entrega el código de recuperación. La implementación por defecto escribe en
/// el log (válido para desarrollo); si hay SMTP configurado (Email__SmtpHost),
/// se envía por correo. SMS queda pendiente (IOtpSender enchufable).
public interface IRecoveryCodeSender
{
    Task SendCodeAsync(string userId, string destination, string code, CancellationToken ct);
}

public sealed class RecoveryCodeSender(IConfiguration cfg, ILogger<RecoveryCodeSender> log) : IRecoveryCodeSender
{
    public async Task SendCodeAsync(string userId, string destination, string code, CancellationToken ct)
    {
        var via = await TrySendEmailAsync(destination, code, ct) ? "smtp" : "log";
        log.LogInformation(
            "RECOVERY_CODE userId={UserId} destination={Destination} via={Via} code={Code}",
            userId, destination, via, code);
    }

    private async Task<bool> TrySendEmailAsync(string to, string code, CancellationToken ct)
    {
        var host = cfg["Email__SmtpHost"];
        var from = cfg["Email__From"];
        if (host is null || from is null) return false;
        try
        {
            var port = int.TryParse(cfg["Email__SmtpPort"], out var p) ? p : 587;
            var user = cfg["Email__Username"];
            var pass = cfg["Email__Password"];
            using var client = new SmtpClient(host, port)
            {
                EnableSsl = true,
                Credentials = string.IsNullOrWhiteSpace(user)
                    ? CredentialCache.DefaultNetworkCredentials
                    : new NetworkCredential(user, pass),
                Timeout = 15000
            };
            using var msg = new MailMessage(from, to)
            {
                Subject = "Tu código de recuperación de Vendelo",
                Body = $"""
                    Recibiste este mensaje porque pediste recuperar tu cuenta de Vendelo.

                    Tu código es: {code}

                    Tiene validez de 10 minutos. Si no fuiste tú, ignora este correo.
                    """,
                IsBodyHtml = false
            };
            await client.SendMailAsync(msg, ct);
            return true;
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "No se pudo enviar el correo a {To}; se escribe en el log.", to);
            return false;
        }
    }
}