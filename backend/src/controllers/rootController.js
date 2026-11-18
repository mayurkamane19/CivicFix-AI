/**
 * Controller to handle root endpoint
 * GET /
 */
export const getRoot = (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Welcome to CivicFix AI API'
    });
  } catch (error) {
    next(error);
  }
};
