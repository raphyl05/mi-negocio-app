using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vendelo.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Backups",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    BusinessId = table.Column<string>(type: "text", nullable: false),
                    PayloadJson = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Backups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Businesses",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OwnerName = table.Column<string>(type: "text", nullable: true),
                    BusinessType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CapabilitiesJson = table.Column<string>(type: "text", nullable: false),
                    SettingsJson = table.Column<string>(type: "text", nullable: false),
                    CapabilityVersion = table.Column<long>(type: "bigint", nullable: false),
                    NextOrderNumber = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Businesses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CashClosures",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RegisterId = table.Column<string>(type: "text", nullable: false),
                    OpeningAmountCents = table.Column<long>(type: "bigint", nullable: false),
                    ExpectedCents = table.Column<long>(type: "bigint", nullable: false),
                    ClosingAmountCents = table.Column<long>(type: "bigint", nullable: false),
                    DifferenceCents = table.Column<long>(type: "bigint", nullable: false),
                    SalesByMethodJson = table.Column<string>(type: "text", nullable: false),
                    Overventa = table.Column<bool>(type: "boolean", nullable: false),
                    Seq = table.Column<long>(type: "bigint", nullable: false),
                    OpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BusinessId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashClosures", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CashRegisters",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    OpeningAmountCents = table.Column<long>(type: "bigint", nullable: false),
                    OpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    State = table.Column<string>(type: "text", nullable: false),
                    BusinessId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashRegisters", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Customers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    BusinessId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    Address = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Deleted = table.Column<bool>(type: "boolean", nullable: false),
                    Seq = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Customers", x => new { x.BusinessId, x.Id });
                });

            migrationBuilder.CreateTable(
                name: "Devices",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    BusinessId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    RegisteredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Devices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DeviceSessions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    DeviceId = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    RefreshTokenHash = table.Column<string>(type: "text", nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AbsoluteExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeviceSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Memberships",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    BusinessId = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Memberships", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Orders",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    BusinessId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Number = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    PrepStatus = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    OrderType = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    WaiterId = table.Column<string>(type: "text", nullable: true),
                    WaiterName = table.Column<string>(type: "text", nullable: true),
                    TableId = table.Column<string>(type: "text", nullable: true),
                    TableName = table.Column<string>(type: "text", nullable: true),
                    CustomerId = table.Column<string>(type: "text", nullable: true),
                    CustomerName = table.Column<string>(type: "text", nullable: true),
                    CustomerPhone = table.Column<string>(type: "text", nullable: true),
                    CustomerAddress = table.Column<string>(type: "text", nullable: true),
                    CustomerDescription = table.Column<string>(type: "text", nullable: true),
                    TotalCents = table.Column<long>(type: "bigint", nullable: false),
                    ReceivedCents = table.Column<long>(type: "bigint", nullable: false),
                    ChangeCents = table.Column<long>(type: "bigint", nullable: false),
                    PaymentMethod = table.Column<string>(type: "text", nullable: true),
                    ItemsJson = table.Column<string>(type: "text", nullable: false),
                    EventsJson = table.Column<string>(type: "text", nullable: false),
                    Overventa = table.Column<bool>(type: "boolean", nullable: false),
                    Deleted = table.Column<bool>(type: "boolean", nullable: false),
                    Seq = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    KitchenTicketId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Orders", x => new { x.BusinessId, x.Id });
                });

            migrationBuilder.CreateTable(
                name: "Products",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    BusinessId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    PriceCents = table.Column<long>(type: "bigint", nullable: false),
                    OpeningStock = table.Column<long>(type: "bigint", nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    Deleted = table.Column<bool>(type: "boolean", nullable: false),
                    Seq = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => new { x.BusinessId, x.Id });
                });

            migrationBuilder.CreateTable(
                name: "Providers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    BusinessId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    Address = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Deleted = table.Column<bool>(type: "boolean", nullable: false),
                    Seq = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Providers", x => new { x.BusinessId, x.Id });
                });

            migrationBuilder.CreateTable(
                name: "Sequences",
                columns: table => new
                {
                    BusinessId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    NextSeq = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sequences", x => x.BusinessId);
                });

            migrationBuilder.CreateTable(
                name: "StockMovements",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ProductId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    MovementType = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Quantity = table.Column<long>(type: "bigint", nullable: false),
                    AmountCents = table.Column<long>(type: "bigint", nullable: true),
                    OrderId = table.Column<string>(type: "text", nullable: true),
                    DeviceId = table.Column<string>(type: "text", nullable: true),
                    Seq = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BusinessId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockMovements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SyncBatches",
                columns: table => new
                {
                    BusinessId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    OpType = table.Column<string>(type: "text", nullable: false),
                    AppliedSeq = table.Column<long>(type: "bigint", nullable: false),
                    ResponseJson = table.Column<string>(type: "text", nullable: false),
                    AppliedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SyncBatches", x => new { x.BusinessId, x.RequestId });
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Username = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Phone = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    ChangeEpoch = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Backups_BusinessId_Id",
                table: "Backups",
                columns: new[] { "BusinessId", "Id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Businesses_Name",
                table: "Businesses",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_CashClosures_BusinessId_Seq",
                table: "CashClosures",
                columns: new[] { "BusinessId", "Seq" });

            migrationBuilder.CreateIndex(
                name: "IX_Customers_BusinessId_Seq",
                table: "Customers",
                columns: new[] { "BusinessId", "Seq" });

            migrationBuilder.CreateIndex(
                name: "IX_Customers_BusinessId_UpdatedAt",
                table: "Customers",
                columns: new[] { "BusinessId", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Devices_BusinessId_Id",
                table: "Devices",
                columns: new[] { "BusinessId", "Id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeviceSessions_RefreshTokenHash",
                table: "DeviceSessions",
                column: "RefreshTokenHash");

            migrationBuilder.CreateIndex(
                name: "IX_Memberships_UserId_BusinessId",
                table: "Memberships",
                columns: new[] { "UserId", "BusinessId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_BusinessId_Number",
                table: "Orders",
                columns: new[] { "BusinessId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_BusinessId_Seq",
                table: "Orders",
                columns: new[] { "BusinessId", "Seq" });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_BusinessId_Status",
                table: "Orders",
                columns: new[] { "BusinessId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Products_BusinessId_Seq",
                table: "Products",
                columns: new[] { "BusinessId", "Seq" });

            migrationBuilder.CreateIndex(
                name: "IX_Products_BusinessId_UpdatedAt",
                table: "Products",
                columns: new[] { "BusinessId", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Providers_BusinessId_Seq",
                table: "Providers",
                columns: new[] { "BusinessId", "Seq" });

            migrationBuilder.CreateIndex(
                name: "IX_Providers_BusinessId_UpdatedAt",
                table: "Providers",
                columns: new[] { "BusinessId", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_BusinessId_Seq",
                table: "StockMovements",
                columns: new[] { "BusinessId", "Seq" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Phone",
                table: "Users",
                column: "Phone",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Backups");

            migrationBuilder.DropTable(
                name: "Businesses");

            migrationBuilder.DropTable(
                name: "CashClosures");

            migrationBuilder.DropTable(
                name: "CashRegisters");

            migrationBuilder.DropTable(
                name: "Customers");

            migrationBuilder.DropTable(
                name: "Devices");

            migrationBuilder.DropTable(
                name: "DeviceSessions");

            migrationBuilder.DropTable(
                name: "Memberships");

            migrationBuilder.DropTable(
                name: "Orders");

            migrationBuilder.DropTable(
                name: "Products");

            migrationBuilder.DropTable(
                name: "Providers");

            migrationBuilder.DropTable(
                name: "Sequences");

            migrationBuilder.DropTable(
                name: "StockMovements");

            migrationBuilder.DropTable(
                name: "SyncBatches");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
