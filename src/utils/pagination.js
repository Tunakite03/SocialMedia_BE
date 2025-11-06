/**
 * Pagination utilities for efficient database queries
 */

/**
 * Creates optimized pagination parameters
 * @param {Object} params - Pagination parameters
 * @param {number} params.limit - Number of items per page
 * @param {number} params.offset - Number of items to skip (for offset-based)
 * @param {string} params.cursor - Cursor for cursor-based pagination
 * @param {boolean} params.useCursor - Whether to use cursor-based pagination
 * @param {string} params.orderBy - Field to order by (default: 'createdAt')
 * @param {string} params.orderDirection - Order direction (asc/desc)
 * @returns {Object} Optimized pagination config
 */
export const createPaginationConfig = ({
   limit = 10,
   offset = 0,
   cursor = null,
   useCursor = false,
   orderBy = 'createdAt',
   orderDirection = 'desc',
}) => {
   const parsedLimit = parseInt(limit);
   const parsedOffset = parseInt(offset);

   // Performance warning for large offsets
   const shouldWarnAboutPerformance = !useCursor && parsedOffset > 100;

   // Recommend cursor pagination for large datasets
   const shouldUseCursor = useCursor || parsedOffset > 500;

   return {
      take: parsedLimit + 1, // Take one extra to check hasMore
      skip: shouldUseCursor ? undefined : parsedOffset,
      orderBy: {
         [orderBy]: orderDirection,
      },
      cursor:
         shouldUseCursor && cursor
            ? {
                 [orderBy]: new Date(cursor),
              }
            : undefined,
      where:
         shouldUseCursor && cursor
            ? {
                 [orderBy]: {
                    [orderDirection === 'desc' ? 'lt' : 'gt']: new Date(cursor),
                 },
              }
            : {},
      meta: {
         originalLimit: parsedLimit,
         originalOffset: parsedOffset,
         useCursor: shouldUseCursor,
         performanceWarning: shouldWarnAboutPerformance,
         recommendCursor: parsedOffset > 100,
      },
   };
};

/**
 * Processes paginated results
 * @param {Array} results - Query results
 * @param {Object} config - Pagination config from createPaginationConfig
 * @param {string} cursorField - Field to use as cursor (default: 'createdAt')
 * @returns {Object} Processed pagination result
 */
export const processPaginatedResults = (results, config, cursorField = 'createdAt') => {
   const { originalLimit, originalOffset, useCursor, performanceWarning, recommendCursor } = config.meta;

   const hasMore = results.length > originalLimit;
   const items = hasMore ? results.slice(0, originalLimit) : results;

   // Get next cursor
   const nextCursor = items.length > 0 && useCursor ? items[items.length - 1][cursorField]?.toISOString() : null;

   return {
      items,
      pagination: {
         limit: originalLimit,
         offset: originalOffset,
         hasMore,
         total: null, // Don't calculate total for performance
         nextCursor,
         performanceHint: performanceWarning
            ? `Large offset detected (${originalOffset}). Consider using cursor-based pagination for better performance.`
            : recommendCursor
            ? 'For optimal performance with large datasets, use cursor-based pagination.'
            : null,
      },
   };
};

/**
 * Calculates estimated total count efficiently
 * @param {Object} prisma - Prisma client
 * @param {string} model - Model name
 * @param {Object} whereClause - Where conditions
 * @returns {Promise<number|null>} Estimated count or null if too expensive
 */
export const getEstimatedTotal = async (prisma, model, whereClause = {}) => {
   try {
      // Only calculate count for simple queries to avoid performance issues
      const isSimpleQuery = Object.keys(whereClause).length <= 2;

      if (!isSimpleQuery) {
         return null; // Skip count for complex queries
      }

      // Use aggregate for better performance than count()
      const result = await prisma[model].aggregate({
         where: whereClause,
         _count: { id: true },
      });

      return result._count.id;
   } catch (error) {
      console.warn('Failed to get estimated total:', error.message);
      return null;
   }
};

/**
 * Default pagination limits
 */
export const PAGINATION_LIMITS = {
   MIN_LIMIT: 1,
   MAX_LIMIT: 100,
   DEFAULT_LIMIT: 10,
   CURSOR_THRESHOLD: 100, // Switch to cursor after this offset
   PERFORMANCE_WARNING_THRESHOLD: 50,
};

/**
 * Validates and sanitizes pagination parameters
 */
export const validatePaginationParams = (params) => {
   const { limit, offset, cursor } = params;

   const validatedLimit = Math.min(
      Math.max(parseInt(limit) || PAGINATION_LIMITS.DEFAULT_LIMIT, PAGINATION_LIMITS.MIN_LIMIT),
      PAGINATION_LIMITS.MAX_LIMIT
   );

   const validatedOffset = Math.max(parseInt(offset) || 0, 0);

   return {
      limit: validatedLimit,
      offset: validatedOffset,
      cursor: cursor || null,
      useCursor: validatedOffset > PAGINATION_LIMITS.CURSOR_THRESHOLD || !!cursor,
   };
};
