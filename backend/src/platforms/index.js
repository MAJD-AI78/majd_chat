// Enhanced Orchestration Layer for Platform Integration
const { logger } = require('../utils/logger');
const config = require('../config');

// Import all platform connectors
const chatgpt = require('./chatgpt');
const perplexity = require('./perplexity');
const gemini = require('./gemini');
const copilot = require('./copilot');
const deepseek = require('./deepseek');
const grok3 = require('./grok3');
const vertix = require('./vertix');
const local = require('./local');

class PlatformOrchestrator {
  constructor() {
    this.platforms = {
      chatgpt,
      perplexity,
      gemini,
      copilot,
      deepseek,
      grok3,
      vertix,
      local
    };
    
    this.platformPriorities = {
      default: ['chatgpt', 'perplexity', 'gemini', 'deepseek', 'grok3', 'vertix', 'copilot', 'local'],
      code: ['copilot', 'deepseek', 'chatgpt', 'perplexity', 'gemini', 'grok3', 'vertix', 'local'],
      research: ['perplexity', 'gemini', 'chatgpt', 'grok3', 'deepseek', 'vertix', 'copilot', 'local'],
      math: ['deepseek', 'gemini', 'chatgpt', 'perplexity', 'grok3', 'vertix', 'copilot', 'local'],
      creative: ['chatgpt', 'gemini', 'perplexity', 'grok3', 'deepseek', 'vertix', 'copilot', 'local'],
      visual: ['gemini', 'grok3', 'chatgpt', 'perplexity', 'deepseek', 'vertix', 'copilot', 'local'],
      arabic: ['chatgpt', 'gemini', 'perplexity', 'deepseek', 'grok3', 'vertix', 'copilot', 'local']
    };
  }
  
  async routeRequest(message, context = {}, options = {}) {
    try {
      logger.info('Routing request through platform orchestrator');
      
      // Determine task type and domain
      const { taskType, domain } = this._analyzeRequest(message, options);
      
      // Select appropriate platform
      const platform = await this._selectPlatform(taskType, domain, options);
      
      // Process request with selected platform
      const result = await this._processWithPlatform(platform, message, context, options);
      
      // Handle fallback if needed
      if (result.error && config.features.enableFallbackChain) {
        return await this._handleFallback(message, context, options, platform, result);
      }
      
      return result;
    } catch (error) {
      logger.error('Error in platform orchestration:', error);
      return {
        error: true,
        message: `Platform orchestration failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  async processMultiPlatformRequest(message, context = {}, platforms = [], options = {}) {
    try {
      logger.info(`Processing multi-platform request across ${platforms.length} platforms`);
      
      if (!platforms || platforms.length === 0) {
        throw new Error('No platforms specified for multi-platform request');
      }
      
      // Process request on each specified platform
      const results = await Promise.all(
        platforms.map(async (platformName) => {
          try {
            const platform = this._getPlatform(platformName);
            return await platform.processRequest(message, context, options);
          } catch (error) {
            logger.error(`Error processing request on ${platformName}:`, error);
            return {
              error: true,
              platform: platformName,
              message: error.message,
              timestamp: new Date().toISOString()
            };
          }
        })
      );
      
      return {
        results,
        timestamp: new Date().toISOString(),
        platforms: platforms
      };
    } catch (error) {
      logger.error('Error in multi-platform processing:', error);
      return {
        error: true,
        message: `Multi-platform processing failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // Private methods
  
  _analyzeRequest(message, options) {
    // Determine task type and domain based on message content and options
    let taskType = options.taskType || 'general';
    let domain = options.domain || 'default';
    
    // Simple content analysis if not specified
    if (!options.taskType) {
      if (message.includes('```') || /\b(code|function|class|method|api)\b/i.test(message)) {
        taskType = 'code';
        domain = 'code';
      } else if (/\b(research|study|paper|analysis|investigate)\b/i.test(message)) {
        taskType = 'research';
        domain = 'research';
      } else if (/\b(math|equation|calculate|formula|computation)\b/i.test(message)) {
        taskType = 'math';
        domain = 'math';
      } else if (/\b(story|creative|write|poem|novel|fiction)\b/i.test(message)) {
        taskType = 'creative';
        domain = 'creative';
      } else if (/\b(image|picture|diagram|chart|visual)\b/i.test(message)) {
        taskType = 'visual';
        domain = 'visual';
      }
      
      // Check for Arabic content
      if (/[\u0600-\u06FF]/.test(message)) {
        domain = 'arabic';
      }
    }
    
    return { taskType, domain };
  }
  
  async _selectPlatform(taskType, domain, options) {
    // Use explicitly specified platform if provided
    if (options.platform && this.platforms[options.platform]) {
      return options.platform;
    }
    
    // Get priority list for the domain
    const priorityList = this.platformPriorities[domain] || this.platformPriorities.default;
    
    // Filter out unavailable platforms
    const availablePlatforms = priorityList.filter(platform => {
      // Skip platforms that have been attempted in fallback chain
      if (options.attemptedPlatforms && options.attemptedPlatforms.includes(platform)) {
        return false;
      }
      
      // Check if platform is available
      return this._isPlatformAvailable(platform);
    });
    
    if (availablePlatforms.length === 0) {
      throw new Error('No available platforms for request');
    }
    
    return availablePlatforms[0];
  }
  
  _isPlatformAvailable(platformName) {
    const platform = this.platforms[platformName];
    
    if (!platform) {
      return false;
    }
    
    // Check for special cases
    if (platformName === 'local' && !config.features.enableLocalModels) {
      return false;
    }
    
    return true;
  }
  
  _getPlatform(platformName) {
    const platform = this.platforms[platformName];
    
    if (!platform) {
      throw new Error(`Platform not found: ${platformName}`);
    }
    
    return platform;
  }
  
  async _processWithPlatform(platformName, message, context, options) {
    try {
      const platform = this._getPlatform(platformName);
      
      logger.info(`Processing request with ${platformName}`);
      
      const result = await platform.processRequest(message, context, options);
      
      // Add platform name to result if not already included
      if (!result.platform) {
        result.platform = platformName;
      }
      
      return result;
    } catch (error) {
      logger.error(`Error processing with ${platformName}:`, error);
      return {
        error: true,
        platform: platformName,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  async _handleFallback(message, context, options, attemptedPlatform, errorResult) {
    logger.info(`Handling fallback after ${attemptedPlatform} error: ${errorResult.message}`);
    
    // Track attempted platforms
    const attemptedPlatforms = options.attemptedPlatforms || [];
    attemptedPlatforms.push(attemptedPlatform);
    
    // Get fallback recommendations if available
    const recommendedFallbacks = errorResult.fallbackRecommendation || [];
    
    // Prepare fallback options
    const fallbackOptions = {
      ...options,
      attemptedPlatforms,
      isFallback: true,
      originalPlatform: attemptedPlatform,
      originalError: errorResult.message
    };
    
    // Try recommended fallbacks first
    for (const fallbackPlatform of recommendedFallbacks) {
      if (!attemptedPlatforms.includes(fallbackPlatform) && this._isPlatformAvailable(fallbackPlatform)) {
        logger.info(`Trying recommended fallback platform: ${fallbackPlatform}`);
        const result = await this._processWithPlatform(fallbackPlatform, message, context, fallbackOptions);
        
        if (!result.error) {
          result.fallbackFrom = attemptedPlatform;
          return result;
        }
        
        attemptedPlatforms.push(fallbackPlatform);
      }
    }
    
    // If recommended fallbacks failed, try other available platforms
    const { taskType, domain } = this._analyzeRequest(message, options);
    const priorityList = this.platformPriorities[domain] || this.platformPriorities.default;
    
    for (const fallbackPlatform of priorityList) {
      if (!attemptedPlatforms.includes(fallbackPlatform) && this._isPlatformAvailable(fallbackPlatform)) {
        logger.info(`Trying fallback platform: ${fallbackPlatform}`);
        const result = await this._processWithPlatform(fallbackPlatform, message, context, fallbackOptions);
        
        if (!result.error) {
          result.fallbackFrom = attemptedPlatform;
          return result;
        }
        
        attemptedPlatforms.push(fallbackPlatform);
      }
    }
    
    // If all fallbacks failed, return original error with fallback information
    return {
      ...errorResult,
      fallbackAttempted: true,
      attemptedPlatforms,
      message: `All platforms failed. Original error: ${errorResult.message}`
    };
  }
}

module.exports = new PlatformOrchestrator();
