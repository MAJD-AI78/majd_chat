/**
 * Orchestration Layer Main Module for Majd Platform
 * 
 * This module integrates the TaskRouter, ContextManager, ThinkingEngine, and ResponseSynthesizer
 * components to provide a unified orchestration layer for the Majd platform.
 */

const { TaskRouter } = require('./taskRouter');
const { ContextManager } = require('./contextManager');
const { ThinkingEngine } = require('./thinkingEngine');
const { ResponseSynthesizer } = require('./responseSynthesizer');
const { logger } = require('../utils/logger');
const config = require('../config');

class OrchestrationLayer {
  constructor() {
    this.taskRouter = new TaskRouter();
    this.contextManager = new ContextManager();
    this.thinkingEngine = new ThinkingEngine();
    this.responseSynthesizer = new ResponseSynthesizer();
    
    this.initialized = false;
  }

  /**
   * Initialize the orchestration layer
   */
  async initialize() {
    try {
      // Initialize components
      await this.contextManager.initialize();
      
      this.initialized = true;
      logger.info('Orchestration Layer initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Orchestration Layer', error);
      return false;
    }
  }

  /**
   * Process a user request through the orchestration layer
   * 
   * @param {string} userInput - The user's input
   * @param {string} userId - The user's ID
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - The processed response
   */
  async processRequest(userInput, userId, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Start processing metrics
      const startTime = Date.now();
      
      // Step 1: Route the request to the appropriate platform
      const routingInfo = await this.taskRouter.routeRequest(userInput, userId, options);
      logger.info('Request routed', { 
        userId, 
        taskType: routingInfo.taskType, 
        platform: routingInfo.platform 
      });
      
      // Step 2: Get conversation context
      const context = await this.contextManager.getContext(userId, {
        platform: routingInfo.platform,
        userInput,
        enableSemanticSearch: options.enableSemanticSearch
      });
      
      // Step 3: Generate thinking prompts
      const thinkingPrompts = this.thinkingEngine.generateThinkingPrompts(
        routingInfo.taskType,
        userInput,
        options
      );
      
      // Step 4: Format context for the selected platform
      const platformContext = this.contextManager.formatContextForPlatform(
        context,
        routingInfo.platform
      );
      
      // Step 5: Enhance prompt with thinking instructions
      const enhancedPrompt = this.thinkingEngine.enhancePromptWithThinking(
        platformContext,
        thinkingPrompts,
        routingInfo.platform
      );
      
      // Step 6: Call the appropriate platform module
      const platformModule = this.getPlatformModule(routingInfo.platform);
      
      if (!platformModule) {
        throw new Error(`Platform module not found for ${routingInfo.platform}`);
      }
      
      const platformResponse = await platformModule.generateResponse(
        enhancedPrompt,
        {
          ...options,
          userId,
          taskType: routingInfo.taskType
        }
      );
      
      // Step 7: Process the response
      const processedResponse = await this.responseSynthesizer.processResponse(
        platformResponse,
        {
          ...routingInfo,
          thinkingPrompts
        },
        {
          format: options.responseFormat || 'markdown',
          includeThinking: options.includeThinking !== false,
          includeAttribution: options.includeAttribution !== false,
          extractThinking: true
        }
      );
      
      // Step 8: Save the context
      await this.contextManager.saveContext(
        userId,
        userInput,
        processedResponse.content,
        {
          platform: routingInfo.platform,
          taskType: routingInfo.taskType,
          timestamp: new Date().toISOString()
        }
      );
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      logger.info('Request processed', { 
        userId, 
        processingTime,
        platform: routingInfo.platform,
        taskType: routingInfo.taskType
      });
      
      return {
        ...processedResponse,
        processingTime,
        routingInfo
      };
    } catch (error) {
      logger.error('Error processing request', error);
      
      // Try fallback if primary platform fails
      if (options.enableFallback !== false && !options.isFallback) {
        return this.handleFallback(userInput, userId, error, options);
      }
      
      // Return error response if fallback is disabled or already tried
      return {
        content: 'I encountered an issue processing your request. Please try again.',
        formattedResponse: 'I encountered an issue processing your request. Please try again.',
        error: error.message,
        timestamp: new Date().toISOString(),
        userId
      };
    }
  }

  /**
   * Handle fallback to secondary or local platform
   * 
   * @param {string} userInput - The user's input
   * @param {string} userId - The user's ID
   * @param {Error} error - The error that triggered fallback
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - The fallback response
   */
  async handleFallback(userInput, userId, error, options = {}) {
    try {
      logger.info('Attempting fallback', { userId, error: error.message });
      
      // Get routing info again to determine fallback platform
      const routingInfo = await this.taskRouter.routeRequest(userInput, userId, options);
      
      // Determine fallback platform
      let fallbackPlatform;
      
      if (options.isFallbackSecondary) {
        // If secondary already failed, use local
        fallbackPlatform = routingInfo.fallback;
      } else {
        // Use secondary platform first
        fallbackPlatform = routingInfo.secondary;
      }
      
      logger.info('Using fallback platform', { 
        userId, 
        fallbackPlatform,
        originalPlatform: routingInfo.platform
      });
      
      // Process with fallback platform
      return this.processRequest(userInput, userId, {
        ...options,
        isFallback: true,
        isFallbackSecondary: !options.isFallbackSecondary,
        overridePlatform: fallbackPlatform
      });
    } catch (fallbackError) {
      logger.error('Fallback also failed', fallbackError);
      
      // Return error response if all fallbacks fail
      return {
        content: 'I encountered an issue processing your request, and fallback options also failed. Please try again later.',
        formattedResponse: 'I encountered an issue processing your request, and fallback options also failed. Please try again later.',
        error: fallbackError.message,
        originalError: error.message,
        timestamp: new Date().toISOString(),
        userId
      };
    }
  }

  /**
   * Get the appropriate platform module
   * 
   * @param {string} platform - The platform name
   * @returns {Object} - The platform module
   */
  getPlatformModule(platform) {
    try {
      // Dynamic import would be used in production
      // For now, we'll use a simple mapping
      const platformModules = {
        'chatgpt': require('../platforms/chatgpt'),
        'perplexity': require('../platforms/perplexity'),
        'gemini': require('../platforms/gemini'),
        'copilot': require('../platforms/copilot'),
        'deepseek': require('../platforms/deepseek'),
        'grok3': require('../platforms/grok3'),
        'vertix': require('../platforms/vertix'),
        'local': require('../platforms/local')
      };
      
      return platformModules[platform];
    } catch (error) {
      logger.error(`Error loading platform module for ${platform}`, error);
      return null;
    }
  }

  /**
   * Process a multi-platform request
   * 
   * @param {string} userInput - The user's input
   * @param {string} userId - The user's ID
   * @param {Array} platforms - The platforms to use
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - The merged response
   */
  async processMultiPlatformRequest(userInput, userId, platforms, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Start processing metrics
      const startTime = Date.now();
      
      // Step 1: Route the request to determine task type
      const routingInfo = await this.taskRouter.routeRequest(userInput, userId, options);
      
      // Step 2: Process request on each platform
      const platformResponses = [];
      
      for (const platform of platforms) {
        try {
          const platformResponse = await this.processRequest(
            userInput,
            userId,
            {
              ...options,
              overridePlatform: platform,
              enableFallback: false // Disable fallback for multi-platform requests
            }
          );
          
          platformResponses.push(platformResponse);
        } catch (error) {
          logger.error(`Error processing on platform ${platform}`, error);
          // Continue with other platforms
        }
      }
      
      // Step 3: Merge responses
      const mergedResponse = await this.responseSynthesizer.mergeResponses(
        platformResponses,
        {
          format: options.responseFormat || 'markdown',
          mergeStrategy: options.mergeStrategy || 'task_specific',
          includeSectionHeaders: options.includeSectionHeaders !== false
        }
      );
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      logger.info('Multi-platform request processed', { 
        userId, 
        processingTime,
        platforms,
        taskType: routingInfo.taskType
      });
      
      return {
        ...mergedResponse,
        processingTime,
        routingInfo
      };
    } catch (error) {
      logger.error('Error processing multi-platform request', error);
      
      // Return error response
      return {
        content: 'I encountered an issue processing your multi-platform request. Please try again.',
        formattedResponse: 'I encountered an issue processing your multi-platform request. Please try again.',
        error: error.message,
        timestamp: new Date().toISOString(),
        userId
      };
    }
  }
}

module.exports = { OrchestrationLayer };
