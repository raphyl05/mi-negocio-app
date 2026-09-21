using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Vendelo.Api.Data;

public sealed class VendeloDbContext(DbContextOptions<VendeloDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Business> Businesses => Set<Business>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<DeviceSession> DeviceSessions => Set<DeviceSession>();
    public DbSet<OrganizationSequence> Sequences => Set<OrganizationSequence>();
    public DbSet<SyncBatch> SyncBatches => Set<SyncBatch>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Provider> Providers => Set<Provider>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<CashRegister> CashRegisters => Set<CashRegister>();
    public DbSet<CashClosure> CashClosures => Set<CashClosure>();
    public DbSet<Backup> Backups => Set<Backup>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Email).IsUnique();
            e.HasIndex(x => x.Phone).IsUnique();
            e.Property(x => x.Email).HasMaxLength(255);
            e.Property(x => x.Phone).HasMaxLength(64);
            e.Property(x => x.Username).HasMaxLength(120);
        });

        b.Entity<Membership>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.BusinessId }).IsUnique();
            e.Property(x => x.Role).HasMaxLength(16);
        });

        b.Entity<Business>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Name);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.BusinessType).HasMaxLength(32);
        });

        b.Entity<Device>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.BusinessId, x.Id }).IsUnique();
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.BusinessId).HasMaxLength(64);
            e.Property(x => x.Role).HasMaxLength(16);
        });

        b.Entity<DeviceSession>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.RefreshTokenHash);
        });

        b.Entity<OrganizationSequence>(e =>
        {
            e.HasKey(x => x.BusinessId);
            e.Property(x => x.BusinessId).HasMaxLength(64);
        });

        b.Entity<SyncBatch>(e =>
        {
            e.HasKey(x => new { x.BusinessId, x.RequestId });
            e.Property(x => x.BusinessId).HasMaxLength(64);
            e.Property(x => x.RequestId).HasMaxLength(64);
        });

        b.Entity<Product>(e =>
        {
            e.HasKey(x => new { x.BusinessId, x.Id });
            e.HasIndex(x => new { x.BusinessId, x.Seq });
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.BusinessId).HasMaxLength(64);
            e.HasIndex(x => new { x.BusinessId, x.UpdatedAt });
        });
        b.Entity<Customer>(e =>
        {
            e.HasKey(x => new { x.BusinessId, x.Id });
            e.HasIndex(x => new { x.BusinessId, x.Seq });
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.BusinessId).HasMaxLength(64);
            e.HasIndex(x => new { x.BusinessId, x.UpdatedAt });
        });
        b.Entity<Provider>(e =>
        {
            e.HasKey(x => new { x.BusinessId, x.Id });
            e.HasIndex(x => new { x.BusinessId, x.Seq });
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.BusinessId).HasMaxLength(64);
            e.HasIndex(x => new { x.BusinessId, x.UpdatedAt });
        });

        b.Entity<Order>(e =>
        {
            e.HasKey(x => new { x.BusinessId, x.Id });
            e.HasIndex(x => new { x.BusinessId, x.Seq });
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.BusinessId).HasMaxLength(64);
            e.HasIndex(x => new { x.BusinessId, x.Status });
            e.HasIndex(x => new { x.BusinessId, x.Number }).IsUnique();
            e.Property(x => x.Status).HasMaxLength(16);
            e.Property(x => x.PrepStatus).HasMaxLength(16);
            e.Property(x => x.OrderType).HasMaxLength(16);
        });

        b.Entity<StockMovement>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.BusinessId, x.Seq });
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.BusinessId).HasMaxLength(64);
            e.Property(x => x.ProductId).HasMaxLength(64);
            e.Property(x => x.MovementType).HasMaxLength(16);
        });

        b.Entity<CashRegister>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.BusinessId).HasMaxLength(64);
        });

        b.Entity<CashClosure>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.BusinessId, x.Seq });
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.BusinessId).HasMaxLength(64);
        });

        b.Entity<Backup>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.BusinessId, x.Id }).IsUnique();
        });

        var utcConverter = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTimeOffset, DateTime>(
            v => v.UtcDateTime,
            v => new DateTimeOffset(v, TimeSpan.Zero));
        foreach (var et in b.Model.GetEntityTypes())
            foreach (var p in et.GetProperties())
                if (p.ClrType == typeof(DateTimeOffset))
                    p.SetValueConverter(utcConverter);
    }

    public async Task<long> NextSeqAsync(string businessId, CancellationToken ct = default)
    {
        var seq = await Sequences.AsTracking().FirstOrDefaultAsync(x => x.BusinessId == businessId, ct);
        if (seq is null)
        {
            seq = new OrganizationSequence { BusinessId = businessId, NextSeq = 1 };
            Sequences.Add(seq);
        }
        var v = seq.NextSeq;
        seq.NextSeq++;
        return v;
    }

    public async Task<int> EnsureSeqAsync(string businessId, CancellationToken ct = default)
    {
        var exists = await Sequences.AsNoTracking().AnyAsync(x => x.BusinessId == businessId, ct);
        if (!exists)
        {
            Sequences.Add(new OrganizationSequence { BusinessId = businessId, NextSeq = 1 });
            await SaveChangesAsync(ct);
        }
        return 0;
    }

    public async Task<bool> BusinessHasDataAsync(string businessId, CancellationToken ct = default)
    {
        var hasAny =
            await Products.AsNoTracking().AnyAsync(x => x.BusinessId == businessId, ct) ||
            await Customers.AsNoTracking().AnyAsync(x => x.BusinessId == businessId, ct) ||
            await Providers.AsNoTracking().AnyAsync(x => x.BusinessId == businessId, ct) ||
            await Orders.AsNoTracking().AnyAsync(x => x.BusinessId == businessId, ct) ||
            await StockMovements.AsNoTracking().AnyAsync(x => x.BusinessId == businessId, ct) ||
            await CashClosures.AsNoTracking().AnyAsync(x => x.BusinessId == businessId, ct) ||
            await SyncBatches.AsNoTracking().AnyAsync(x => x.BusinessId == businessId, ct);
        return hasAny;
    }
}