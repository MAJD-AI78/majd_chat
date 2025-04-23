/**
 * Task Router Component for Majd Platform
 * 
 * This component is responsible for analyzing user requests and determining
 * the most appropriate AI platform to handle the request based on the task type.
 * It uses a combination of rule-based classification and ML-based classification.
 */

const { DeepseekClassifier } = require('../models/deepseekClassifier');
const { ContextManager } = require('./contextManager');
const { logger } = require('../utils/logger');
const config = require('../config');

class TaskRouter {
  constructor() {
    this.classifier = new DeepseekClassifier();
    this.contextManager = new ContextManager();
    this.taskTypes = {
      RESEARCH: 'research',
      REASONING: 'reasoning',
      CODE: 'code',
      CREATIVE: 'creative',
      DATA_ANALYSIS: 'data_analysis',
      DOMAIN_EXPERTISE: 'domain_expertise',
      GENERAL: 'general'
    };
    
    // Platform mapping based on task type
    this.platformMapping = {
      [this.taskTypes.RESEARCH]: {
        primary: 'perplexity',
        secondary: 'gemini',
        fallback: 'local'
      },
      [this.taskTypes.REASONING]: {
        primary: 'deepseek',
        secondary: 'gemini',
        fallback: 'local'
      },
      [this.taskTypes.CODE]: {
        primary: 'copilot',
        secondary: 'deepseek',
        fallback: 'local'
      },
      [this.taskTypes.CREATIVE]: {
        primary: 'chatgpt',
        secondary: 'gemini',
        fallback: 'local'
      },
      [this.taskTypes.DATA_ANALYSIS]: {
        primary: 'grok3',
        secondary: 'gemini',
        fallback: 'local'
      },
      [this.taskTypes.DOMAIN_EXPERTISE]: {
        primary: 'vertix',
        secondary: 'chatgpt',
        fallback: 'local'
      },
      [this.taskTypes.GENERAL]: {
        primary: 'chatgpt',
        secondary: 'deepseek',
        fallback: 'local'
      }
    };
    
    // Initialize the classifier
    this.initializeClassifier();
  }
  
  /**
   * Initialize the ML classifier for task routing
   */
  async initializeClassifier() {
    try {
      await this.classifier.initialize();
      logger.info('Task Router classifier initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Task Router classifier', error);
      // Fall back to rule-based classification if ML classifier fails
    }
  }
  
  /**
   * Classify the task type based on user input and context
   * 
   * @param {string} userInput - The user's input text
   * @param {string} userId - The user's ID for context retrieval
   * @param {Object} options - Additional options for classification
   * @returns {Promise<string>} - The classified task type
   */
  async classifyTask(userInput, userId, options = {}) {
    try {
      // Get conversation context
      const context = await this.contextManager.getContext(userId);
      
      // Try ML-based classification first
      if (this.classifier.isInitialized) {
        const mlClassification = await this.classifier.classify(userInput, context);
        logger.debug('ML classification result', { classification: mlClassification });
        
        if (mlClassification.confidence > config.ML_CONFIDENCE_THRESHOLD) {
          return mlClassification.taskType;
        }
      }
      
      // Fall back to rule-based classification
      return this.ruleBasedClassification(userInput, context);
    } catch (error) {
      logger.error('Error in task classification', error);
      // Default to general task type if classification fails
      return this.taskTypes.GENERAL;
    }
  }
  
  /**
   * Rule-based classification as fallback
   * 
   * @param {string} userInput - The user's input text
   * @param {Array} context - The conversation context
   * @returns {string} - The classified task type
   */
  ruleBasedClassification(userInput, context) {
    const input = userInput.toLowerCase();
    
    // Check for code-related tasks
    if (
      input.includes('code') || 
      input.includes('function') || 
      input.includes('programming') ||
      input.includes('debug') ||
      input.includes('algorithm') ||
      input.match(/```[a-z]*\n/g) // Code block markers
    ) {
      return this.taskTypes.CODE;
    }
    
    // Check for research-related tasks
    if (
      input.includes('research') || 
      input.includes('find information') || 
      input.includes('search for') ||
      input.includes('look up') ||
      input.includes('what is') ||
      input.includes('tell me about')
    ) {
      return this.taskTypes.RESEARCH;
    }
    
    // Check for reasoning tasks
    if (
      input.includes('solve') || 
      input.includes('calculate') || 
      input.includes('math') ||
      input.includes('logic') ||
      input.includes('prove') ||
      input.includes('explain why')
    ) {
      return this.taskTypes.REASONING;
    }
    
    // Check for creative tasks
    if (
      input.includes('write a') || 
      input.includes('create a') || 
      input.includes('generate a') ||
      input.includes('design') ||
      input.includes('story') ||
      input.includes('poem')
    ) {
      return this.taskTypes.CREATIVE;
    }
    
    // Check for data analysis tasks
    if (
      input.includes('analyze') || 
      input.includes('data') || 
      input.includes('trends') ||
      input.includes('statistics') ||
      input.includes('graph') ||
      input.includes('chart')
    ) {
      return this.taskTypes.DATA_ANALYSIS;
    }
    
    // Check for domain expertise tasks based on specific keywords
    // This would be expanded based on Vertix's specific domains
    if (
      input.includes('industry') || 
      input.includes('sector') || 
      input.includes('specialized') ||
      input.includes('expert') ||
      input.includes('professional')
    ) {
      return this.taskTypes.DOMAIN_EXPERTISE;
    }
    
    // Default to general task type
    return this.taskTypes.GENERAL;
  }
  
  /**
   * Get the appropriate platform for the classified task
   * 
   * @param {string} taskType - The classified task type
   * @param {Object} options - Options for platform selection
   * @returns {Object} - The selected platform information
   */
  getPlatformForTask(taskType, options = {}) {
    // Get the platform mapping for the task type
    const platformMap = this.platformMapping[taskType] || this.platformMapping[this.taskTypes.GENERAL];
    
    // Check if user has preferences that override the default
    if (options.userPreferences && options.userPreferences.preferredPlatform) {
      return {
        platform: options.userPreferences.preferredPlatform,
        taskType,
        isUserPreferred: true
      };
    }
    
    // Check if cost optimization is enabled
    if (options.optimizeCost && !options.isPremiumUser) {
      // For non-premium users, prefer lower-cost platforms
      return {
        platform: platformMap.fallback,
        taskType,
        isCostOptimized: true
      };
    }
    
    // Return the primary platform for the task type
    return {
      platform: platformMap.primary,
      taskType,
      secondary: platformMap.secondary,
      fallback: platformMap.fallback
    };
  }
  
  /**
   * Route a user request to the appropriate platform
   * 
   * @param {string} userInput - The user's input text
   * @param {string} userId - The user's ID
   * @param {Object} options - Additional options for routing
   * @returns {Promise<Object>} - The routing decision
   */
  async routeRequest(userInput, userId, options = {}) {
    try {
      // Classify the task
      const taskType = await this.classifyTask(userInput, userId, options);
      
      // Get the platform for the task
      const platformInfo = this.getPlatformForTask(taskType, options);
      
      // Log the routing decision
      logger.info('Request routed', { 
        userId, 
        taskType, 
        platform: platformInfo.platform,
        secondary: platformInfo.secondary,
        fallback: platformInfo.fallback
      });
      
      return {
        userId,
        userInput,
        taskType,
        platform: platformInfo.platform,
        secondary: platformInfo.secondary,
        fallback: platformInfo.fallback,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error routing request', error);
      
      // Return default routing in case of error
      return {
        userId,
        userInput,
        taskType: this.taskTypes.GENERAL,
        platform: 'chatgpt',
        secondary: 'deepseek',
        fallback: 'local',
        timestamp: new Date().toISOString(),
        isErrorFallback: true
      };
    }
  }
}

module.exports = { TaskRouter };
