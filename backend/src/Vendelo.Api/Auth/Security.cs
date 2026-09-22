using System.Security.Cryptography;
using System.Text;
using Isopoh.Cryptography.Argon2;

namespace Vendelo.Api.Auth;

public static class PasswordHasher
{
    private const int Iterations = 3;
    private const int MemoryKib = 65536;
    private const int Lanes = 1;
    private const int Threads = 1;

    public static string Hash(string password)
    {
        var cfg = new Argon2Config
        {
            Type = Argon2Type.HybridAddressing,
            Version = Argon2Version.Nineteen,
            TimeCost = Iterations,
            MemoryCost = MemoryKib,
            Lanes = Lanes,
            Threads = Threads,
            Salt = RandomNumberGenerator.GetBytes(16),
            Password = Encoding.UTF8.GetBytes(password)
        };
        return Argon2.Hash(cfg);
    }

    public static bool Verify(string password, string encoded)
    {
        try
        {
            var cfg = new Argon2Config
            {
                Type = Argon2Type.HybridAddressing,
                Version = Argon2Version.Nineteen,
                TimeCost = Iterations,
                MemoryCost = MemoryKib,
                Lanes = Lanes,
                Threads = Threads,
                Salt = new byte[16],
                Password = Encoding.UTF8.GetBytes(password)
            };
            return Argon2.Verify(encoded, cfg);
        }
        catch
        {
            return false;
        }
    }

    public static string RandomToken(int bytes = 48)
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(bytes))
            .Replace("+", "-").Replace("/", "_").Replace("=", "").TrimEnd();
    }

    public static string Sha256(string value)
    {
        var h = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(h);
    }

    public static bool VerifyConstantTime(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
}