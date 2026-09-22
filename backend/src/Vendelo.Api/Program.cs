using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Vendelo.Api;
using Vendelo.Api.Auth;
using Vendelo.Api.Common;
using Vendelo.Api.Data;
using Vendelo.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddCors(o => o.AddPolicy("dev", c => c.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var dbProvider = builder.Configuration["Database:Provider"] ?? "Npgsql";
builder.Services.AddDbContext<VendeloDbContext>(o =>
{
    if (dbProvider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
        o.UseSqlite(builder.Configuration.GetConnectionString("Vendelo") ?? "DataSource=vendelo.db");
    else
        o.UseNpgsql(builder.Configuration.GetConnectionString("Vendelo")
            ?? "Host=localhost;Database=vendelo;Username=postgres;Password=postgres;");
});

var jwtSecret = builder.Configuration["Jwt__Key"];
var isDev = builder.Environment.IsDevelopment();
if (string.IsNullOrWhiteSpace(jwtSecret))
    jwtSecret = isDev ? "vendelo-dev-only-key-please-rotate-in-prod-0123456789abcdef"
                       : throw new InvalidOperationException("Jwt__Key no está configurado.");
var jwtIssuer = builder.Configuration["Jwt__Issuer"] ?? "vendelo-api";
var jwtAudience = builder.Configuration["Jwt__Audience"] ?? "vendelo-app";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        // PARTE 5: `users.changeEpoch` (reset/cambio de contraseña) invalida todas las sesiones
        // emitidas antes del cambio, en todos los endpoints autenticados.
        opt.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnTokenValidated = async ctx =>
            {
                var db = ctx.HttpContext.RequestServices.GetRequiredService<VendeloDbContext>();
                var userId = ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                var cep = ctx.Principal?.FindFirst("cep")?.Value;
                if (userId is null || cep is null)
                {
                    ctx.Fail("Sesión incompleta.");
                    return;
                }
                var who = await db.Users.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == userId);
                if (who is null
                    || !long.TryParse(cep, out var issuedCep)
                    || who.ChangeEpoch.ToUnixTimeSeconds() > issuedCep)
                    ctx.Fail("Tu sesión fue revocada. Vuelve a iniciar sesión.");
            }
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddControllers();

builder.Services.AddSingleton<TokenService>();
builder.Services.AddScoped<AccessService>();
builder.Services.AddSingleton<RateLimiter>();
builder.Services.AddSingleton<RecoveryCodeStore>();
builder.Services.AddSingleton<IRecoveryCodeSender, RecoveryCodeSender>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseCors("dev");
app.UseMiddleware<ApiErrorHandlingMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapBusinessEndpoints();
app.MapCatalogEndpoints();
app.MapOrderEndpoints();
app.MapKitchenEndpoints();
app.MapSyncEndpoints();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<VendeloDbContext>();
    await db.Database.EnsureCreatedAsync();
}

app.Run();

public partial class Program { }