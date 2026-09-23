using Microsoft.EntityFrameworkCore;
using Vendelo.Api.Auth;
using Vendelo.Api.Common;
using Vendelo.Api.Data;

namespace Vendelo.Api.Endpoints;

public static class AuthEndpoints
{
    private static readonly HashSet<string> ValidBusinessTypes =
        ["COMMERCE", "RESTAURANT", "FOOD_TRUCK", "MOBILE_VENDOR", "SERVICE", "OTHER"];

    private static readonly HashSet<string> ValidCapabilityKeys =
        ["restaurant", "waiters", "tables", "kitchen", "kitchenPrinting"];

    public static void MapAuthEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/v1");

        g.MapPost("/auth/register", RegisterAsync);
        g.MapPost("/auth/login", LoginAsync);
        g.MapPost("/auth/refresh", RefreshAsync);
        g.MapPost("/auth/switch-business", SwitchBusinessAsync).RequireAuthorization();
        g.MapPost("/auth/logout", LogoutAsync);
        g.MapPost("/auth/change-password", ChangePasswordAsync).RequireAuthorization();
        g.MapGet("/auth/me", MeAsync).RequireAuthorization();
        g.MapGet("/auth/session", MeAsync).RequireAuthorization();
        g.MapPost("/auth/recovery/request", RequestRecoveryAsync);
        g.MapPost("/accounts/recover", RequestRecoveryAsync);
        g.MapPost("/auth/recovery/verify", VerifyRecoveryAsync);
        g.MapPost("/auth/recovery/reset-password", ResetPasswordAsync);
    }

    private static void BumpRate(RateLimiter limiter, string key, int max) =>
        RateLimiter.Enforce(limiter, key, max, RlWindow);

    private static readonly TimeSpan RlWindow = TimeSpan.FromMinutes(1);

    private static readonly string DummyHash = PasswordHasher.Hash("dummy-timing-equalizer");

    private static async Task<IResult> RegisterAsync(
        RegisterRequestDto req, HttpContext http, VendeloDbContext db, TokenService tokens, RateLimiter rl,
        CancellationToken ct)
    {
        req.Identifier = (req.Identifier ?? "").Trim();
        req.Password ??= "";
        req.DeviceId = (req.DeviceId ?? "").Trim();
        req.Name = (req.Name ?? "").Trim();
        var ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        BumpRate(rl, $"reg:ip:{ip}", 120);
        if (req.Identifier.Length >= 3) BumpRate(rl, $"reg:acc:{req.Identifier.ToLowerInvariant()}", 8);
        if (req.Password.Length < 8) throw Bad("password debe tener mínimo 8 caracteres.");
        if (string.IsNullOrWhiteSpace(req.DeviceId) || req.DeviceId.Length > 64) throw Bad("deviceId inválido.");
        if (string.IsNullOrWhiteSpace(req.Name)) throw Bad("name es obligatorio.");

        var email = (req.Email ?? "").Trim().ToLowerInvariant();
        var phone = (req.Phone ?? "").Trim();
        if (email.Length == 0 && phone.Length == 0)
        {
            // Compatibilidad: el identifier solía ser el único canal (correo o teléfono).
            email = req.Identifier.Contains('@') ? req.Identifier.ToLowerInvariant() : "";
            phone = email.Length == 0 ? req.Identifier : "";
        }
        if (email.Length > 0)
        {
            if (!email.Contains('@') || email.Length > 255) throw Bad("email inválido.");
            if (await db.Users.AnyAsync(x => x.Email != null && x.Email == email, ct))
                throw new AppException("CONFLICT",
                    "No se pudo completar el registro. Verifica tus datos e intenta de nuevo.", 409);
        }
        if (phone.Length > 0)
        {
            var digits = new string(phone.Where(char.IsDigit).ToArray());
            if (digits.Length is < 8 or > 20) throw Bad("phone inválido.");
            if (await db.Users.AnyAsync(x => x.Phone != null && x.Phone == phone, ct))
                throw new AppException("CONFLICT",
                    "No se pudo completar el registro. Verifica tus datos e intenta de nuevo.", 409);
        }

        var businessType = req.BusinessType ?? "COMMERCE";
        if (!ValidBusinessTypes.Contains(businessType)) throw Bad("businessType inválido.");

        var exists = email is not null
            ? await db.Users.AnyAsync(x => x.Email != null && x.Email == email, ct)
            : phone is not null
                ? await db.Users.AnyAsync(x => x.Phone != null && x.Phone == phone, ct)
                : false;
        if (exists)
            throw new AppException("CONFLICT", "No se pudo completar el registro. Verifica tus datos e intenta de nuevo.", 409);

        var now = DateTimeOffset.UtcNow;
        var userId = GenId.UserId();
        var businessId = GenId.NewId(req.BusinessId, "business");
        if (await db.Businesses.AnyAsync(x => x.Id == businessId, ct))
            throw new AppException("CONFLICT", "El businessId ya existe.", 409);

        var caps = BuildCapabilities(req.Capabilities);
        var settings = req.Settings ?? new Dictionary<string, object?>();

        var user = new User
        {
            Id = userId,
            Username = req.Name,
            Email = string.IsNullOrEmpty(email) ? null : email,
            Phone = string.IsNullOrEmpty(phone) ? null : phone,
            PasswordHash = PasswordHasher.Hash(req.Password),
            ChangeEpoch = now,
            CreatedAt = now
        };
        var business = new Business
        {
            Id = businessId,
            Name = req.Name,
            OwnerName = req.OwnerName,
            BusinessType = businessType,
            CapabilitiesJson = Json.Ser(caps),
            SettingsJson = Json.Ser(settings),
            CapabilityVersion = 1,
            NextOrderNumber = 1,
            CreatedAt = now,
            UpdatedAt = now
        };
        var membership = new Membership
        {
            Id = GenId.MembershipId(),
            UserId = userId,
            BusinessId = businessId,
            Role = Roles.Owner,
            Active = true,
            CreatedAt = now
        };
        var device = new Device
        {
            Id = req.DeviceId,
            BusinessId = businessId,
            Name = req.DeviceName ?? req.DeviceId,
            Role = Roles.Admin,
            Active = true,
            RegisteredAt = now
        };
        db.Users.Add(user);
        db.Businesses.Add(business);
        db.Memberships.Add(membership);
        db.Devices.Add(device);
        db.Sequences.Add(new OrganizationSequence { BusinessId = businessId, NextSeq = 1 });
        await db.SaveChangesAsync(ct);

        var (pair, _) = await IssueSessionAsync(db, tokens, businessId, userId, req.DeviceId, ct);

        return Results.Json(new LoginResponseDto
        {
            AccessToken = pair.AccessToken,
            RefreshToken = pair.RefreshToken,
            User = AuthUserDto.From(user),
            Businesses = [BusinessLiteDto.From(business, Roles.Owner)]
        }, statusCode: 201);
    }

    private static async Task<IResult> LoginAsync(
        LoginRequestDto req, HttpContext http, VendeloDbContext db, TokenService tokens, RateLimiter rl,
        CancellationToken ct)
    {
        req.Identifier = (req.Identifier ?? "").Trim();
        var ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        BumpRate(rl, $"login:ip:{ip}", 300);
        if (req.Identifier.Length >= 3) BumpRate(rl, $"login:acc:{req.Identifier.ToLowerInvariant()}", 8);
        if (!string.IsNullOrWhiteSpace(req.DeviceId)) BumpRate(rl, $"login:dev:{req.DeviceId}", 20);
        if (req.Identifier.Length < 3)
            throw new AppException("UNAUTHORIZED", "Credenciales inválidas.", 401);

        var isEmail = req.Identifier.Contains('@');
        var user = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(x => isEmail ? x.Email == req.Identifier : x.Phone == req.Identifier, ct);

        if (user is null)
        {
            // Iguala el tiempo de respuesta con una verificación real (anti-enumeración por timing).
            PasswordHasher.Verify(req.Password ?? "", DummyHash);
            throw new AppException("UNAUTHORIZED", "Credenciales inválidas.", 401);
        }

        if (!PasswordHasher.Verify(req.Password ?? "", user.PasswordHash))
            throw new AppException("UNAUTHORIZED", "Credenciales inválidas.", 401);

        var membership = await db.Memberships.AsNoTracking()
            .OrderBy(x => x.CreatedAt)
            .FirstAsync(x => x.UserId == user.Id && x.Active, ct);
        var business = await db.Businesses.AsNoTracking()
            .FirstAsync(x => x.Id == membership.BusinessId, ct);
        var device = await EnsureDeviceAsync(db, business.Id, req.DeviceId, req.DeviceName, req.DeviceRole, ct);

        var (pair, _) = await IssueSessionAsync(db, tokens, business.Id, user.Id, device.Id, ct);

        return Results.Ok(await SessionPayloadAsync(db, pair, user, business, membership.Role, ct));
    }

    private static async Task<IResult> RefreshAsync(
        RefreshRequestDto req, HttpContext http, VendeloDbContext db, TokenService tokens, RateLimiter rl,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.RefreshToken))
            throw new AppException("UNAUTHORIZED", "refreshToken inválido.", 401);

        var ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        BumpRate(rl, $"ref:ip:{ip}", 300);
        if (!string.IsNullOrWhiteSpace(req.DeviceId)) BumpRate(rl, $"ref:dev:{req.DeviceId}", 30);

        var hash = PasswordHasher.Sha256(req.RefreshToken);
        var session = await db.DeviceSessions.AsTracking()
            .FirstOrDefaultAsync(x => x.RefreshTokenHash == hash, ct);
        if (session is null)
            throw new AppException("INVALID_TOKEN", "Sesión inválida. Vuelve a iniciar sesión.", 401);

        // PARTE 5: reuso de un refresh ya rotado = 409 (señal de robo).
        if (!session.Active)
            throw new AppException("TOKEN_REUSE",
                "El refresh token ya fue utilizado. Vuelve a iniciar sesión.", 409);

        if (DateTimeOffset.UtcNow > session.ExpiresAt || DateTimeOffset.UtcNow > session.AbsoluteExpiresAt)
        {
            session.Active = false;
            await db.SaveChangesAsync(ct);
            throw new AppException("INVALID_TOKEN", "Sesión inválida o expirada. Vuelve a iniciar sesión.", 401);
        }

        var user = await db.Users.FirstAsync(x => x.Id == session.UserId, ct);
        if (user.ChangeEpoch > session.CreatedAt)
        {
            session.Active = false;
            await db.SaveChangesAsync(ct);
            throw new AppException("INVALID_TOKEN", "Tu sesión fue revocada. Vuelve a iniciar sesión.", 401);
        }

        var device = await db.Devices.FirstOrDefaultAsync(x => x.Id == session.DeviceId &&
            (string.IsNullOrWhiteSpace(req.BusinessId) || x.BusinessId == req.BusinessId), ct);
        var membership = await db.Memberships.AsNoTracking()
            .FirstOrDefaultAsync(
                string.IsNullOrWhiteSpace(req.BusinessId)
                    ? x => x.UserId == session.UserId && x.Active
                    : x => x.UserId == session.UserId && x.BusinessId == req.BusinessId && x.Active,
                ct);
        if (device is null || !device.Active || membership is null)
            throw new AppException("INVALID_TOKEN", "Dispositivo o membresía inválida.", 401);

        var business = await db.Businesses.FirstAsync(x => x.Id == membership.BusinessId, ct);
        session.Active = false;
        var (pair, _) = await IssueSessionAsync(db, tokens, membership.BusinessId, session.UserId, device.Id, ct);

        return Results.Ok(await SessionPayloadAsync(db, pair, user, business, membership.Role, ct));
    }

    private static async Task<IResult> SwitchBusinessAsync(
        SwitchBusinessRequestDto req, HttpContext http, VendeloDbContext db, TokenService tokens, CancellationToken ct)
    {
        var userId = http.User.UserIdOf() ?? throw AppException.Forbidden("Sesión incompleta.");
        if (string.IsNullOrWhiteSpace(req.BusinessId))
            throw new AppException("VALIDATION_ERROR", "businessId es obligatorio.", 400);

        var membership = await db.Memberships.AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId && x.BusinessId == req.BusinessId && x.Active, ct)
            ?? throw AppException.Forbidden("No tienes acceso a ese negocio.");
        var business = await db.Businesses.AsNoTracking()
            .FirstAsync(x => x.Id == membership.BusinessId, ct);

        var deviceId = http.User.DeviceIdOf();
        var device = await EnsureDeviceAsync(db, business.Id, deviceId, req.DeviceName, null, ct);

        var (pair, _) = await IssueSessionAsync(db, tokens, business.Id, userId, device.Id, ct);
        var user = await db.Users.AsNoTracking().FirstAsync(x => x.Id == userId, ct);

        return Results.Ok(await SessionPayloadAsync(db, pair, user, business, membership.Role, ct));
    }

    private static async Task<IResult> MeAsync(
        HttpContext http, VendeloDbContext db, CancellationToken ct)
    {
        var user = http.User.UserIdOf();
        var businessId = http.User.BusinessIdOf();
        if (user is null || businessId is null)
            throw AppException.Forbidden("Sesión incompleta.");
        var u = await db.Users.AsNoTracking().FirstAsync(x => x.Id == user, ct);
        var b = await db.Businesses.AsNoTracking().FirstAsync(x => x.Id == businessId, ct);
        var m = await db.Memberships.AsNoTracking()
            .FirstAsync(x => x.UserId == user && x.BusinessId == businessId, ct);
        // PARTE 5.2 / 32: perfil + membresías. No se emiten tokens nuevos.
        return Results.Ok(await SessionPayloadAsync(db, null, u, b, m.Role, ct));
    }

    private static async Task<IResult> LogoutAsync(
        LogoutRequestDto req, VendeloDbContext db, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.RefreshToken))
            throw AppException.Validation("refreshToken es obligatorio.");

        var hash = PasswordHasher.Sha256(req.RefreshToken);
        var session = await db.DeviceSessions.AsTracking()
            .FirstOrDefaultAsync(x => x.RefreshTokenHash == hash, ct);
        if (session is not null)
        {
            session.Active = false;
            await db.SaveChangesAsync(ct);
        }
        return Results.NoContent();
    }

    private static async Task<IResult> ChangePasswordAsync(
        ChangePasswordRequestDto req, HttpContext http, VendeloDbContext db, CancellationToken ct)
    {
        var userId = http.User.UserIdOf() ?? throw AppException.Forbidden("Sesión incompleta.");
        req.NewPassword ??= "";
        req.CurrentPassword ??= "";
        if (req.NewPassword.Length < 8) throw Bad("La nueva contraseña debe tener mínimo 8 caracteres.");
        if (req.NewPassword == req.CurrentPassword) throw Bad("La nueva contraseña debe ser diferente a la actual.");

        var user = await db.Users.AsTracking().FirstOrDefaultAsync(x => x.Id == userId, ct)
            ?? throw AppException.NotFound("usuario");
        if (!PasswordHasher.Verify(req.CurrentPassword, user.PasswordHash))
            throw new AppException("INVALID_PASSWORD", "La contraseña actual no es correcta.", 400);

        user.PasswordHash = PasswordHasher.Hash(req.NewPassword);
        user.ChangeEpoch = DateTimeOffset.UtcNow;

        var sessions = await db.DeviceSessions.AsTracking()
            .Where(x => x.UserId == userId && x.Active).ToListAsync(ct);
        foreach (var s in sessions) s.Active = false;
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> RequestRecoveryAsync(
        RecoverRequestDto? req, HttpContext http, VendeloDbContext db, TokenService tokens,
        RecoveryCodeStore codes, IRecoveryCodeSender sender, RateLimiter rl,
        IWebHostEnvironment env, CancellationToken ct)
    {
        var identifier = (req?.Identifier ?? "").Trim();
        var ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        BumpRate(rl, $"rec:ip:{ip}", 15);
        if (identifier.Length >= 3) BumpRate(rl, $"rec:acc:{identifier.ToLowerInvariant()}", 4);

        if (identifier.Length < 3 || identifier.Length > 255)
            throw new AppException("VALIDATION_ERROR", "Indicanos tu correo o teléfono.", 400);

        var isEmail = identifier.Contains('@');
        var user = await db.Users.FirstOrDefaultAsync(
            x => isEmail ? x.Email == identifier : x.Phone == identifier, ct);

        // Tiempo de respuesta uniforme aunque la cuenta no exista (anti-enumeración).
        if (user is null)
        {
            PasswordHasher.Verify("", DummyHash);
            return Results.Ok(new { message = "Si la cuenta existe, recibirás un código." });
        }

        var code = codes.Issue(user.Id, TimeSpan.FromMinutes(10));
        await sender.SendCodeAsync(user.Id, identifier, code, ct);

        return Results.Ok(new
        {
            message = "Si la cuenta existe, recibirás un código.",
            expiresInMinutes = 10,
            debugCode = env.IsDevelopment() ? code : null
        });
    }

    private static async Task<IResult> VerifyRecoveryAsync(
        RecoveryVerifyRequestDto req, VendeloDbContext db, TokenService tokens,
        RecoveryCodeStore codes, RateLimiter rl, HttpContext http, CancellationToken ct)
    {
        var identifier = (req.Identifier ?? "").Trim();
        var code = (req.Code ?? "").Trim();
        if (identifier.Length < 3 || code.Length is < 6 or > 8)
            throw new AppException("VALIDATION_ERROR", "Código o cuenta inválidos.", 400);

        var ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        BumpRate(rl, $"recv:ip:{ip}", 20);
        BumpRate(rl, $"recv:acc:{identifier.ToLowerInvariant()}", 6);

        var isEmail = identifier.Contains('@');
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(
            x => isEmail ? x.Email == identifier : x.Phone == identifier, ct);
        if (user is null || !codes.VerifyAndConsume(user.Id, code))
            throw new AppException("INVALID_CODE", "El código es incorrecto o ya expiró.", 400);

        var token = tokens.CreateRecoveryToken(user.Id, user.Username, user.ChangeEpoch.ToUnixTimeSeconds());
        return Results.Ok(new { recoveryToken = token, expiresInMinutes = TokenService.RecoveryTtlMinutes });
    }

    private static async Task<IResult> ResetPasswordAsync(
        RecoveryResetRequestDto req, VendeloDbContext db, TokenService tokens, RateLimiter rl,
        HttpContext http, CancellationToken ct)
    {
        var tokenStr = (req.RecoveryToken ?? "").Trim();
        var password = req.NewPassword ?? "";
        if (password.Length < 8)
            throw Bad("La nueva contraseña debe tener mínimo 8 caracteres.");

        var principal = tokens.ValidateRecoveryToken(tokenStr);
        var userId = principal?.UserIdOf();
        if (userId is null)
            throw new AppException("INVALID_TOKEN", "Tu código ya fue utilizado o expiró.", 401);

        var ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        RateLimiter.Enforce(rl, $"rst:ip:{ip}", 10, TimeSpan.FromMinutes(30));
        RateLimiter.Enforce(rl, $"rst:acc:{userId}", 3, TimeSpan.FromMinutes(30));

        var user = await db.Users.AsTracking().FirstOrDefaultAsync(x => x.Id == userId, ct)
            ?? throw AppException.NotFound("usuario");
        user.PasswordHash = PasswordHasher.Hash(password);
        user.ChangeEpoch = DateTimeOffset.UtcNow;

        var sessions = await db.DeviceSessions.AsTracking()
            .Where(x => x.UserId == userId && x.Active).ToListAsync(ct);
        foreach (var s in sessions) s.Active = false;
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    internal static async Task<LoginResponseDto> SessionPayloadAsync(
        VendeloDbContext db, TokenPair? pair, User user, Business activeBusiness, string role, CancellationToken ct)
    {
        var memberships = await db.Memberships.AsNoTracking()
            .Where(x => x.UserId == user.Id && x.Active).ToListAsync(ct);
        var bizIds = memberships.Select(m => m.BusinessId).ToList();
        var bizs = await db.Businesses.AsNoTracking().Where(x => bizIds.Contains(x.Id)).ToListAsync(ct);

        return new LoginResponseDto
        {
            AccessToken = pair?.AccessToken ?? "",
            RefreshToken = pair?.RefreshToken ?? "",
            User = AuthUserDto.From(user),
            Businesses = memberships
                .Join(bizs, m => m.BusinessId, b => b.Id, (m, b) => BusinessLiteDto.From(b, m.Role))
                .ToList()
        };
    }

    internal static async Task<(TokenPair pair, DeviceSession session)> IssueSessionAsync(
        VendeloDbContext db, TokenService tokens, string businessId, string userId, string deviceId,
        CancellationToken ct)
    {
        var user = await db.Users.FirstAsync(x => x.Id == userId, ct);
        var membership = await db.Memberships.AsNoTracking()
            .FirstAsync(x => x.UserId == userId && x.BusinessId == businessId && x.Active, ct);
        var access = tokens.CreateAccessToken(userId, user.Username, businessId, membership.Role, deviceId,
            user.ChangeEpoch.ToUnixTimeSeconds());
        var (refresh, hash) = tokens.CreateRefreshToken();

        var session = new DeviceSession
        {
            Id = GenId.DeviceSessionId(),
            DeviceId = deviceId,
            UserId = userId,
            RefreshTokenHash = hash,
            Active = true,
            CreatedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(TokenService.RefreshTtlHours),
            AbsoluteExpiresAt = DateTimeOffset.UtcNow.AddDays(TokenService.RefreshAbsoluteDays)
        };
        db.DeviceSessions.Add(session);
        await db.SaveChangesAsync(ct);
        return (new TokenPair(access, refresh, DateTimeOffset.UtcNow.AddMinutes(TokenService.AccessTtlMinutes)), session);
    }

    private static async Task<Device> EnsureDeviceAsync(
        VendeloDbContext db, string businessId, string? deviceId, string? deviceName, string? deviceRole, CancellationToken ct)
    {
        if (deviceRole is not null && !Roles.All.Contains(deviceRole))
            throw new AppException("VALIDATION_ERROR", $"rol inválido. Válidos: {string.Join(", ", Roles.All)}.", 400);
        if (string.IsNullOrWhiteSpace(deviceId) || deviceId.Length > 64)
            deviceId = $"dev-{Guid.NewGuid():N}";
        var existing = await db.Devices.FirstOrDefaultAsync(x => x.Id == deviceId && x.BusinessId == businessId, ct);
        if (existing is not null)
        {
            if (deviceRole is not null)
            {
                existing.Role = deviceRole;
                await db.SaveChangesAsync(ct);
            }
            return existing;
        }
        var device = new Device
        {
            Id = deviceId,
            BusinessId = businessId,
            Name = string.IsNullOrWhiteSpace(deviceName) ? deviceId : deviceName,
            Role = deviceRole,
            Active = true,
            RegisteredAt = DateTimeOffset.UtcNow
        };
        db.Devices.Add(device);
        await db.SaveChangesAsync(ct);
        return device;
    }

    private static Dictionary<string, object?> BuildCapabilities(Dictionary<string, object?>? raw)
    {
        var all = new Dictionary<string, object?>();
        foreach (var key in ValidCapabilityKeys)
            all[key] = raw is not null && raw.TryGetValue(key, out var v) && Json.AsBool(v);
        return all;
    }

    private static AppException Bad(string message) => new("VALIDATION_ERROR", message, 400);
}

public sealed class RecoverRequestDto
{
    [System.Text.Json.Serialization.JsonPropertyName("identifier")]
    public string? Identifier { get; set; }
}
