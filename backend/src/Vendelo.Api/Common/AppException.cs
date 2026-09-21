namespace Vendelo.Api;

public sealed class AppException : Exception
{
    public string Code { get; }
    public int Status { get; }
    public object? Details { get; }

    public AppException(string code, string message, int status = 400, object? details = null)
        : base(message)
    {
        Code = code;
        Status = status;
        Details = details;
    }

    public static AppException NotFound(string what = "recurso") =>
        new("NOT_FOUND", $"El {what} no existe o no tienes acceso.", 404);

    public static AppException Forbidden(string message = "No tienes permiso para esta operación.") =>
        new("FORBIDDEN", message, 403);

    public static AppException InvalidState(string message) =>
        new("INVALID_STATE", message, 409);

    public static AppException Validation(string message) =>
        new("VALIDATION_ERROR", message, 400);
}