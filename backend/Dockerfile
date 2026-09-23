# Vendelo API — multi-stage build
# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/Vendelo.Api/Vendelo.Api.csproj src/Vendelo.Api/
RUN dotnet restore src/Vendelo.Api/Vendelo.Api.csproj

COPY src src

# Publish trimmed, ready-to-run
RUN dotnet publish src/Vendelo.Api/Vendelo.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    -p:PublishSingleFile=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_EnableDiagnostics=0

COPY --from=build /app/publish .

EXPOSE 8080

# healthcheck hits a real DB query in /api/v1/health
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
    CMD curl --fail http://localhost:8080/api/v1/health || exit 1

ENTRYPOINT ["dotnet", "Vendelo.Api.dll"]