import {
  getAnalyticsOverview,
  getAnalyticsTrends,
  getAnalyticsCategories,
  getAnalyticsDepartments,
  getAnalyticsOfficers,
  getAnalyticsResolution,
  getAnalyticsSeverity,
  getAnalyticsGeography,
  getOfficerAnalyticsOverview,
  exportAnalyticsCsv
} from '../services/analyticsService.js';

/**
 * Controller: GET /api/admin/analytics/overview
 */
export const getOverviewController = async (req, res, next) => {
  try {
    const data = await getAnalyticsOverview(req.query);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/analytics/trends
 */
export const getTrendsController = async (req, res, next) => {
  try {
    const data = await getAnalyticsTrends(req.query);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/analytics/categories
 */
export const getCategoriesController = async (req, res, next) => {
  try {
    const data = await getAnalyticsCategories(req.query);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/analytics/departments
 */
export const getDepartmentsController = async (req, res, next) => {
  try {
    const data = await getAnalyticsDepartments(req.query);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/analytics/officers
 */
export const getOfficersController = async (req, res, next) => {
  try {
    const data = await getAnalyticsOfficers(req.query);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/analytics/resolution
 */
export const getResolutionController = async (req, res, next) => {
  try {
    const data = await getAnalyticsResolution(req.query);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/analytics/severity
 */
export const getSeverityController = async (req, res, next) => {
  try {
    const data = await getAnalyticsSeverity(req.query);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/analytics/geography
 */
export const getGeographyController = async (req, res, next) => {
  try {
    const data = await getAnalyticsGeography(req.query);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/admin/analytics/export
 * Downloads sanitized CSV export of aggregated metrics
 */
export const exportCsvController = async (req, res, next) => {
  try {
    const { filename, csvContent } = await exportAnalyticsCsv(req.query);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/officer/analytics/overview
 * Enforces strict IDOR defense: strictly scopes data to req.user._id
 */
export const getOfficerOverviewController = async (req, res, next) => {
  try {
    const officerId = req.user._id ? req.user._id.toString() : req.user.id;
    const data = await getOfficerAnalyticsOverview(officerId, req.query);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};
