
/**
 * Consolidates all ID generators for the application.
 */

/**
 * Generates a standard UUID v4 for the 'id' field.
 */
export const generateUUID = (): string => {
  return crypto.randomUUID();
};

/**
 * Generates a short alphanumeric ID for the 'ROWID' field.
 * This is used for local state management and initial linking.
 */
export const generateROWID = (prefix: string = ''): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix ? `${prefix}_${result}` : result;
};

/**
 * Generates a temporary ID for local-only records.
 */
export const generateTempId = (prefix: string = 'TEMP'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
};

/**
 * Validates if a string is a standard UUID v4.
 */
export const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};
