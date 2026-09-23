using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vendelo.Api.Migrations
{
    /// <inheritdoc />
    public partial class DeviceCompositeKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_Devices",
                table: "Devices");

            migrationBuilder.DropIndex(
                name: "IX_Devices_BusinessId_Id",
                table: "Devices");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Devices",
                table: "Devices",
                columns: new[] { "BusinessId", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_Devices",
                table: "Devices");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Devices",
                table: "Devices",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_Devices_BusinessId_Id",
                table: "Devices",
                columns: new[] { "BusinessId", "Id" },
                unique: true);
        }
    }
}
