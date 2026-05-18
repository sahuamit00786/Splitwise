// /server/src/utils/response.js

/**
 * Send success response
 * @param {object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 */
export function success(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

/**
 * Send error response
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {*} errors - Validation errors
 */
export function error(res, message = 'Error', statusCode = 400, errors = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors
  });
}

/**
 * Send paginated response
 * @param {object} res - Express response object
 * @param {Array} data - Array of items
 * @param {object} pagination - Pagination info
 * @param {string} message - Success message
 */
export function paginated(res, data, pagination, message = 'Success') {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination
  });
}
