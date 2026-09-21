using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Vendelo.Api.Auth;

public sealed record TokenPair(string AccessToken, string RefreshToken, DateTimeOffset AccessExpiresAt);

public sealed class TokenService
{
    public const int AccessTtlMinutes = 15;
    public const int RefreshTtlHours = 48;
    public const int RefreshAbsoluteDays = 30;

    private readonly SymmetricSecurityKey _key;
    private readonly string _issuer;
    private readonly string _audience;

    public TokenService(IConfiguration cfg, IWebHostEnvironment env)
    {
        var secret = cfg["Jwt__Key"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            if (env.IsDevelopment())
                secret = "vendelo-dev-only-key-please-rotate-in-prod-0123456789abcdef";
            else
                throw new InvalidOperationException("Jwt__Key no está configurado.");
        }
        _key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        _issuer = cfg["Jwt__Issuer"] ?? "vendelo-api";
        _audience = cfg["Jwt__Audience"] ?? "vendelo-app";
    }

    public DateTimeOffset HandshakeTtl => DateTimeOffset.Now.AddMinutes(AccessTtlMinutes);

    public string CreateAccessToken(string userId, string username, string businessId, string role, string deviceId)
    {
        var handler = new JwtSecurityTokenHandler();
        var now = DateTimeOffset.UtcNow;
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId),
            new(JwtRegisteredClaimNames.UniqueName, username),
            new("busid", businessId),
            new("role", role),
            new("dev", deviceId),
        };
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = _issuer,
            Audience = _audience,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = now.AddMinutes(AccessTtlMinutes).UtcDateTime,
            SigningCredentials = new SigningCredentials(_key, SecurityAlgorithms.HmacSha256)
        };
        return handler.CreateEncodedJwt(descriptor);
    }

    public (string refresh, string hash) CreateRefreshToken()
    {
        var token = PasswordHasher.RandomToken(64);
        return (token, PasswordHasher.Sha256(token));
    }

    public static ClaimsPrincipal? ValidateAccessToken(string token, IConfiguration cfg, IWebHostEnvironment env)
    {
        var secret = cfg["Jwt__Key"];
        if (string.IsNullOrWhiteSpace(secret))
            secret = env.IsDevelopment() ? "vendelo-dev-only-key-please-rotate-in-prod-0123456789abcdef" : null;
        if (secret is null) return null;
        var handler = new JwtSecurityTokenHandler();
        try
        {
            return handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                ValidateIssuer = true,
                ValidIssuer = cfg["Jwt__Issuer"] ?? "vendelo-api",
                ValidateAudience = true,
                ValidAudience = cfg["Jwt__Audience"] ?? "vendelo-app",
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30)
            }, out _);
        }
        catch
        {
            return null;
        }
    }
}