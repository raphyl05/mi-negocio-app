using System.Security.Cryptography;
using System.Text;

namespace Vendelo.Api.Common;

/// Cifrado en reposo de los respaldos (AES-GCM). La clave se deriva de
/// "Encryption__Key" (HMAC-SHA256) y en dev hay un valor por defecto.
public static class Cipher
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private static byte[] Key(IConfiguration cfg)
    {
        var raw = cfg["Encryption__Key"];
        if (string.IsNullOrWhiteSpace(raw))
            raw = "vendelo-dev-encryption-key-please-rotate-in-prod";
        return SHA256.HashData(Encoding.UTF8.GetBytes(raw));
    }

    public static string Encrypt(IConfiguration cfg, string plainText)
    {
        var key = Key(cfg);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var plain = Encoding.UTF8.GetBytes(plainText);
        var cipher = new byte[plain.Length];
        var tag = new byte[TagSize];
        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(nonce, plain, cipher, tag);
        return Convert.ToBase64String(nonce.Concat(tag).Concat(cipher).ToArray());
    }

    /// Devuelve el texto claro o null si el payload no se pudo descifrar (por
    /// ejemplo, un respaldo legacy guardado antes de cifrar).
    public static string? TryDecrypt(IConfiguration cfg, string enc)
    {
        try
        {
            var raw = Convert.FromBase64String(enc);
            if (raw.Length < NonceSize + TagSize) return null;
            var key = Key(cfg);
            var nonce = raw.AsSpan(0, NonceSize);
            var tag = raw.AsSpan(NonceSize, TagSize);
            var cipher = raw.AsSpan(NonceSize + TagSize);
            var plain = new byte[cipher.Length];
            using var aes = new AesGcm(key, TagSize);
            aes.Decrypt(nonce, cipher, tag, plain);
            return Encoding.UTF8.GetString(plain);
        }
        catch
        {
            return null;
        }
    }
}