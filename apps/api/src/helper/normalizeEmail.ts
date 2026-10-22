export function normalizeEmail(email: string) {
    return typeof email === 'string'
        ? email.trim().toLowerCase()
        : email;
}