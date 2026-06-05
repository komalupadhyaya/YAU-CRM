// In-memory cache tracking user IDs whose roles or status have changed.
// Maps userId (string) -> timestamp (number) of the change.
export const invalidatedUsers = new Map();

