import { dbService } from '../services/dbService';

/**
 * Wraps a Supabase CRUD operation with audit logging.
 */
export const withSupabaseLogging = async <T>(
  userName: string,
  actionType: string,
  description: string,
  operation: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> => {
  const startTime = performance.now();
  try {
    const result = await operation();
    const executionTime = Math.round(performance.now() - startTime);

    if (result.error) {
      dbService.logActivity(userName, actionType, description, 'FAILED', {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
      }, executionTime);
    } else {
      dbService.logActivity(userName, actionType, description, 'SUCCESS', null, executionTime);
    }

    return result;
  } catch (err: any) {
    const executionTime = Math.round(performance.now() - startTime);
    dbService.logActivity(userName, actionType, description, 'FAILED', {
      message: err.message || 'Unknown error',
      stack: err.stack,
    }, executionTime);
    throw err;
  }
};

/**
 * Wraps an external script call (e.g., Google Apps Script) with audit logging.
 */
export const withExternalScriptLogging = async <T extends { success?: boolean; message?: string }>(
  userName: string,
  actionType: string,
  description: string,
  operation: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  try {
    const result = await operation();
    const executionTime = Math.round(performance.now() - startTime);

    // Check for logical failure in the response body
    if (result && result.success === false) {
      dbService.logActivity(userName, actionType, description, 'FAILED', {
        message: result.message || 'External script reported failure',
        payload: result,
      }, executionTime);
    } else {
      dbService.logActivity(userName, actionType, description, 'SUCCESS', null, executionTime);
    }

    return result;
  } catch (err: any) {
    const executionTime = Math.round(performance.now() - startTime);
    dbService.logActivity(userName, actionType, description, 'FAILED', {
      message: err.message || 'Network or execution error',
      stack: err.stack,
    }, executionTime);
    throw err;
  }
};

/**
 * Wraps a generic network fetch call with audit logging.
 */
export const withNetworkLogging = async (
  userName: string,
  actionType: string,
  description: string,
  operation: () => Promise<Response>
): Promise<Response> => {
  const startTime = performance.now();
  try {
    const response = await operation();
    const executionTime = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read response text');
      dbService.logActivity(userName, actionType, description, 'FAILED', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        body: errorText,
      }, executionTime);
    } else {
      dbService.logActivity(userName, actionType, description, 'SUCCESS', null, executionTime);
    }

    return response;
  } catch (err: any) {
    const executionTime = Math.round(performance.now() - startTime);
    dbService.logActivity(userName, actionType, description, 'FAILED', {
      message: err.message || 'Failed to fetch',
      name: err.name,
      stack: err.stack,
    }, executionTime);
    throw err;
  }
};
