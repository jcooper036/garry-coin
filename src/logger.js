const winston = require('winston');

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(logColors);

// Create the logger
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(({ timestamp, level, message, category, ...meta }) => {
          let logMessage = `${timestamp} [${level}]`;
          
          // Add category if present
          if (category) {
            logMessage += ` [${category.toUpperCase()}]`;
          }
          
          logMessage += ` ${message}`;
          
          // Add metadata if present
          if (Object.keys(meta).length > 0) {
            logMessage += ` ${JSON.stringify(meta)}`;
          }
          
          return logMessage;
        })
      )
    })
  ],
});

// Helper functions for common log patterns
const logCategories = {
  DATABASE: 'database',
  GAME: 'game',
  COMMAND: 'command',
  TRANSFER: 'transfer',
  SYSTEM: 'system',
  ERROR: 'error',
  HEIST: 'heist',
  WORDLE: 'wordle',
  LOTTERY: 'lottery',
  BOT: 'bot',
  LOAN: 'loan'
};

// Convenience methods for structured logging
const structuredLog = {
  info: (message, metadata = {}) => {
    logger.info(message, metadata);
  },
  
  error: (message, metadata = {}) => {
    logger.error(message, metadata);
  },
  
  warn: (message, metadata = {}) => {
    logger.warn(message, metadata);
  },
  
  debug: (message, metadata = {}) => {
    logger.debug(message, metadata);
  },
  
  // Category-specific loggers
  database: (message, metadata = {}) => {
    logger.info(message, { ...metadata, category: logCategories.DATABASE });
  },
  
  game: (message, metadata = {}) => {
    logger.info(message, { ...metadata, category: logCategories.GAME });
  },
  
  command: (message, metadata = {}) => {
    logger.info(message, { ...metadata, category: logCategories.COMMAND });
  },
  
  transfer: (message, metadata = {}) => {
    logger.info(message, { ...metadata, category: logCategories.TRANSFER });
  },
  
  heist: (message, metadata = {}) => {
    logger.info(message, { ...metadata, category: logCategories.HEIST });
  },
  
  wordle: (message, metadata = {}) => {
    logger.info(message, { ...metadata, category: logCategories.WORDLE });
  },
  
  lottery: (message, metadata = {}) => {
    logger.info(message, { ...metadata, category: logCategories.LOTTERY });
  },
  
  bot: (message, metadata = {}) => {
    logger.info(message, { ...metadata, category: logCategories.BOT });
  },
  
  loan: (message, metadata = {}) => {
    logger.info(message, { ...metadata, category: logCategories.LOAN });
  },
  
  // Error logging with category
  dbError: (message, error, metadata = {}) => {
    logger.error(message, { 
      ...metadata, 
      category: logCategories.DATABASE, 
      error: error.message,
      stack: error.stack 
    });
  },
  
  gameError: (message, error, metadata = {}) => {
    logger.error(message, { 
      ...metadata, 
      category: logCategories.GAME, 
      error: error.message,
      stack: error.stack 
    });
  }
};

module.exports = {
  logger,
  structuredLog,
  logCategories
};