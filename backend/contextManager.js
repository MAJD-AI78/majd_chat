/**
 * Context Manager Component for Majd Platform
 * 
 * This component is responsible for managing conversation context across
 * different AI platforms, ensuring a coherent user experience regardless
 * of which backend system is processing the request.
 */

const { VectorDatabase } = require('../database/vectorDatabase');
const { logger } = require('../utils/logger');
const config = require('../config');

class ContextManager {
  constructor() {
    this.vectorDb = new VectorDatabase();
    this.maxContextLength = config.MAX_CONTEXT_LENGTH || 10;
    this.contextWindowSizes = {
      'chatgpt': 128000,
      'perplexity': 32000,
      'gemini': 1000000, // 1M tokens
      'copilot': 64000,
      'deepseek': 128000,
      'grok3': 128000,
      'vertix': 32000,
      'local': 32000
    };
  }

  /**
   * Initialize the context manager
   */
  async initialize() {
    try {
      await this.vectorDb.initialize();
      logger.info('Context Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Context Manager', error);
      throw error;
    }
  }

  /**
   * Get the conversation context for a user
   * 
   * @param {string} userId - The user's ID
   * @param {Object} options - Additional options for context retrieval
   * @returns {Promise<Array>} - The conversation context
   */
  async getContext(userId, options = {}) {
    try {
      // Get the platform to determine context window size
      const platform = options.platform || 'chatgpt';
      const contextWindowSize = this.contextWindowSizes[platform] || 32000;
      
      // Retrieve recent conversation history
      const conversationHistory = await this.vectorDb.getConversationHistory(
        userId, 
        this.maxContextLength
      );
      
      // Optimize context based on platform's context window size
      const optimizedContext = this.optimizeContext(conversationHistory, contextWindowSize);
      
      // If semantic search is enabled, retrieve relevant past conversations
      if (options.enableSemanticSearch && options.userInput) {
        const relevantHistory = await this.vectorDb.searchSimilarConversations(
          userId,
          options.userInput,
          options.maxRelevantItems || 3
        );
        
        // Merge and optimize again
        return this.mergeAndOptimizeContext(optimizedContext, relevantHistory, contextWindowSize);
      }
      
      return optimizedContext;
    } catch (error) {
      logger.error('Error retrieving context', error);
      // Return empty context in case of error
      return [];
    }
  }

  /**
   * Save a conversation turn to the context
   * 
   * @param {string} userId - The user's ID
   * @param {string} userInput - The user's input
   * @param {string} aiResponse - The AI's response
   * @param {Object} metadata - Additional metadata about the conversation
   * @returns {Promise<boolean>} - Success indicator
   */
  async saveContext(userId, userInput, aiResponse, metadata = {}) {
    try {
      // Create conversation turn object
      const conversationTurn = {
        userId,
        userInput,
        aiResponse,
        platform: metadata.platform || 'unknown',
        taskType: metadata.taskType || 'general',
        timestamp: metadata.timestamp || new Date().toISOString()
      };
      
      // Save to vector database
      await this.vectorDb.saveConversationTurn(conversationTurn);
      
      logger.debug('Context saved successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Error saving context', error);
      return false;
    }
  }

  /**
   * Optimize context to fit within platform's context window
   * 
   * @param {Array} context - The conversation context
   * @param {number} contextWindowSize - The platform's context window size
   * @returns {Array} - The optimized context
   */
  optimizeContext(context, contextWindowSize) {
    // Simple token count estimation (can be replaced with more accurate tokenizer)
    const estimateTokens = (text) => {
      return text ? text.split(/\s+/).length * 1.3 : 0; // Rough estimate
    };
    
    let totalTokens = 0;
    const optimizedContext = [];
    
    // Process from most recent to oldest
    for (let i = context.length - 1; i >= 0; i--) {
      const turn = context[i];
      const turnTokens = estimateTokens(turn.userInput) + estimateTokens(turn.aiResponse);
      
      // Check if adding this turn would exceed the context window
      if (totalTokens + turnTokens > contextWindowSize * 0.9) { // 90% of limit to be safe
        break;
      }
      
      // Add turn to optimized context
      optimizedContext.unshift(turn); // Add to beginning to maintain chronological order
      totalTokens += turnTokens;
    }
    
    return optimizedContext;
  }

  /**
   * Merge recent context with relevant historical context
   * 
   * @param {Array} recentContext - Recent conversation context
   * @param {Array} relevantHistory - Relevant historical conversations
   * @param {number} contextWindowSize - The platform's context window size
   * @returns {Array} - The merged and optimized context
   */
  mergeAndOptimizeContext(recentContext, relevantHistory, contextWindowSize) {
    // Combine recent context with relevant history
    const combinedContext = [...recentContext];
    
    // Add a separator to indicate historical context
    if (relevantHistory.length > 0) {
      combinedContext.push({
        userInput: '',
        aiResponse: '--- Relevant past conversations ---',
        isSystemMessage: true
      });
    }
    
    // Add relevant history
    combinedContext.push(...relevantHistory);
    
    // Re-optimize to fit context window
    return this.optimizeContext(combinedContext, contextWindowSize);
  }

  /**
   * Clear the context for a user
   * 
   * @param {string} userId - The user's ID
   * @returns {Promise<boolean>} - Success indicator
   */
  async clearContext(userId) {
    try {
      await this.vectorDb.clearUserConversations(userId);
      logger.info('Context cleared successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Error clearing context', error);
      return false;
    }
  }

  /**
   * Format context for a specific AI platform
   * 
   * @param {Array} context - The conversation context
   * @param {string} platform - The target AI platform
   * @returns {Object} - Platform-specific formatted context
   */
  formatContextForPlatform(context, platform) {
    switch (platform) {
      case 'chatgpt':
        return this.formatForChatGPT(context);
      case 'perplexity':
        return this.formatForPerplexity(context);
      case 'gemini':
        return this.formatForGemini(context);
      case 'copilot':
        return this.formatForCopilot(context);
      case 'deepseek':
        return this.formatForDeepSeek(context);
      case 'grok3':
        return this.formatForGrok3(context);
      case 'vertix':
        return this.formatForVertix(context);
      case 'local':
        return this.formatForLocal(context);
      default:
        return this.formatForChatGPT(context); // Default format
    }
  }

  /**
   * Format context for ChatGPT
   * 
   * @param {Array} context - The conversation context
   * @returns {Object} - ChatGPT-formatted context
   */
  formatForChatGPT(context) {
    const messages = [];
    
    // Add system message
    messages.push({
      role: 'system',
      content: 'You are Majd, an advanced AI assistant that combines the capabilities of multiple AI systems. You provide detailed reasoning and show your thinking process step by step when solving complex problems.'
    });
    
    // Add conversation turns
    context.forEach(turn => {
      if (turn.isSystemMessage) {
        messages.push({
          role: 'system',
          content: turn.aiResponse
        });
      } else {
        messages.push({
          role: 'user',
          content: turn.userInput
        });
        
        if (turn.aiResponse) {
          messages.push({
            role: 'assistant',
            content: turn.aiResponse
          });
        }
      }
    });
    
    return { messages };
  }

  /**
   * Format context for Perplexity
   * 
   * @param {Array} context - The conversation context
   * @returns {Object} - Perplexity-formatted context
   */
  formatForPerplexity(context) {
    // Similar structure to ChatGPT but with Perplexity-specific formatting
    const messages = [];
    
    messages.push({
      role: 'system',
      content: 'You are Majd, an advanced AI research assistant. Provide comprehensive answers with citations and sources when available.'
    });
    
    context.forEach(turn => {
      if (turn.isSystemMessage) {
        messages.push({
          role: 'system',
          content: turn.aiResponse
        });
      } else {
        messages.push({
          role: 'user',
          content: turn.userInput
        });
        
        if (turn.aiResponse) {
          messages.push({
            role: 'assistant',
            content: turn.aiResponse
          });
        }
      }
    });
    
    return { 
      messages,
      search: true, // Enable search for Perplexity
      include_citations: true
    };
  }

  /**
   * Format context for Gemini
   * 
   * @param {Array} context - The conversation context
   * @returns {Object} - Gemini-formatted context
   */
  formatForGemini(context) {
    const contents = [];
    
    // Add system message
    contents.push({
      role: 'system',
      parts: [{
        text: 'You are Majd, an advanced AI assistant with exceptional reasoning capabilities. Show your thinking process step by step.'
      }]
    });
    
    // Add conversation turns
    context.forEach(turn => {
      if (turn.isSystemMessage) {
        contents.push({
          role: 'system',
          parts: [{
            text: turn.aiResponse
          }]
        });
      } else {
        contents.push({
          role: 'user',
          parts: [{
            text: turn.userInput
          }]
        });
        
        if (turn.aiResponse) {
          contents.push({
            role: 'model',
            parts: [{
              text: turn.aiResponse
            }]
          });
        }
      }
    });
    
    return { contents };
  }

  /**
   * Format context for GitHub Copilot
   * 
   * @param {Array} context - The conversation context
   * @returns {Object} - Copilot-formatted context
   */
  formatForCopilot(context) {
    // Copilot-specific formatting
    const messages = [];
    
    messages.push({
      role: 'system',
      content: 'You are Majd, an advanced AI coding assistant. Provide detailed code explanations and step-by-step solutions to programming problems.'
    });
    
    context.forEach(turn => {
      if (turn.isSystemMessage) {
        messages.push({
          role: 'system',
          content: turn.aiResponse
        });
      } else {
        messages.push({
          role: 'user',
          content: turn.userInput
        });
        
        if (turn.aiResponse) {
          messages.push({
            role: 'assistant',
            content: turn.aiResponse
          });
        }
      }
    });
    
    return { 
      messages,
      editor_context: {
        language: 'javascript', // Default language, can be overridden
        editorContent: '' // Can be populated with file content if available
      }
    };
  }

  /**
   * Format context for DeepSeek
   * 
   * @param {Array} context - The conversation context
   * @returns {Object} - DeepSeek-formatted context
   */
  formatForDeepSeek(context) {
    // DeepSeek-specific formatting
    const messages = [];
    
    messages.push({
      role: 'system',
      content: 'You are Majd, an advanced AI assistant with exceptional mathematical and reasoning capabilities. Show your step-by-step thinking process when solving problems.'
    });
    
    context.forEach(turn => {
      if (turn.isSystemMessage) {
        messages.push({
          role: 'system',
          content: turn.aiResponse
        });
      } else {
        messages.push({
          role: 'user',
          content: turn.userInput
        });
        
        if (turn.aiResponse) {
          messages.push({
            role: 'assistant',
            content: turn.aiResponse
          });
        }
      }
    });
    
    return { messages };
  }

  /**
   * Format context for Grok3
   * 
   * @param {Array} context - The conversation context
   * @returns {Object} - Grok3-formatted context
   */
  formatForGrok3(context) {
    // Grok3-specific formatting
    const messages = [];
    
    messages.push({
      role: 'system',
      content: 'You are Majd, an advanced AI assistant with real-time data analysis capabilities. Provide insightful analysis and up-to-date information.'
    });
    
    context.forEach(turn => {
      if (turn.isSystemMessage) {
        messages.push({
          role: 'system',
          content: turn.aiResponse
        });
      } else {
        messages.push({
          role: 'user',
          content: turn.userInput
        });
        
        if (turn.aiResponse) {
          messages.push({
            role: 'assistant',
            content: turn.aiResponse
          });
        }
      }
    });
    
    return { 
      messages,
      use_realtime_data: true
    };
  }

  /**
   * Format context for Vertix
   * 
   * @param {Array} context - The conversation context
   * @returns {Object} - Vertix-formatted context
   */
  formatForVertix(context) {
    // Vertix-specific formatting
    const messages = [];
    
    messages.push({
      role: 'system',
      content: 'You are Majd, an advanced AI assistant with specialized domain expertise. Provide industry-specific insights and domain knowledge.'
    });
    
    context.forEach(turn => {
      if (turn.isSystemMessage) {
        messages.push({
          role: 'system',
          content: turn.aiResponse
        });
      } else {
        messages.push({
          role: 'user',
          content: turn.userInput
        });
        
        if (turn.aiResponse) {
          messages.push({
            role: 'assistant',
            content: turn.aiResponse
          });
        }
      }
    });
    
    return { messages };
  }

  /**
   * Format context for local models
   * 
   * @param {Array} context - The conversation context
   * @returns {Object} - Local model-formatted context
   */
  formatForLocal(context) {
    // Local model-specific formatting (similar to DeepSeek format)
    const messages = [];
    
    messages.push({
      role: 'system',
      content: 'You are Majd, an advanced AI assistant. Provide helpful and accurate responses.'
    });
    
    context.forEach(turn => {
      if (turn.isSystemMessage) {
        messages.push({
          role: 'system',
          content: turn.aiResponse
        });
      } else {
        messages.push({
          role: 'user',
          content: turn.userInput
        });
        
        if (turn.aiResponse) {
          messages.push({
            role: 'assistant',
            content: turn.aiResponse
          });
        }
      }
    });
    
    return { messages };
  }
}

module.exports = { ContextManager };
