// Enhanced ChatGPT Platform Connector with improved error handling and fallback mechanisms
const axios = require('axios');
const { logger } = require('../utils/logger');
const config = require('../config');

class ChatGPTConnector {
  constructor() {
    this.apiKey = config.OPENAI_API_KEY;
    this.model = config.OPENAI_MODEL;
    this.baseUrl = 'https://api.openai.com/v1';
    this.maxRetries = 3;
    this.retryDelay = 1000; // ms
    
    if (!this.apiKey) {
      logger.warn('ChatGPT API key not provided. This connector will not function properly.');
    }
  }
  
  async processRequest(message, context = {}, options = {}) {
    try {
      logger.info('Processing request with ChatGPT');
      
      // Validate inputs
      if (!message) {
        throw new Error('Message is required for ChatGPT processing');
      }
      
      // Prepare request
      const requestOptions = this._prepareRequestOptions(message, context, options);
      
      // Execute request with retry logic
      return await this._executeWithRetry(async () => {
        const response = await this._makeApiRequest('/chat/completions', requestOptions);
        return this._processResponse(response, options);
      });
    } catch (error) {
      logger.error('Error processing request with ChatGPT:', error);
      
      // Provide meaningful error information
      const errorResponse = {
        error: true,
        message: error.message,
        platform: 'ChatGPT',
        status: error.response?.status || 500,
        timestamp: new Date().toISOString(),
        requestId: options.requestId || 'unknown',
        fallbackAvailable: this._checkFallbackAvailability(options)
      };
      
      // If fallback is enabled and available, indicate this in the response
      if (config.features.enableFallbackChain && this._checkFallbackAvailability(options)) {
        errorResponse.fallbackRecommendation = this._suggestFallbackPlatform(error);
      }
      
      return errorResponse;
    }
  }
  
  async executeTask(taskType, content, context, thinkingSteps, options = {}) {
    try {
      logger.info(`Executing ${taskType} task with ChatGPT`);
      
      // Construct prompt based on task type
      let prompt;
      switch (taskType) {
        case 'extract':
          prompt = this._constructExtractionPrompt(content, options);
          break;
        case 'analyze':
          prompt = this._constructAnalysisPrompt(content, options);
          break;
        case 'summarize':
          prompt = this._constructSummarizationPrompt(content, options);
          break;
        case 'extractEntities':
          prompt = this._constructEntityExtractionPrompt(content, options);
          break;
        case 'deepAnalysis':
          prompt = this._constructDeepAnalysisPrompt(content, options);
          break;
        case 'documentQA':
          prompt = this._constructDocumentQAPrompt(content, context, options);
          break;
        default:
          throw new Error(`Unsupported task type: ${taskType}`);
      }
      
      // Include thinking steps if available
      if (thinkingSteps && thinkingSteps.length > 0) {
        prompt = this._incorporateThinkingSteps(prompt, thinkingSteps);
      }
      
      // Process the request
      const result = await this.processRequest(prompt, context, {
        ...options,
        taskType,
        temperature: this._getTemperatureForTask(taskType, options)
      });
      
      return result;
    } catch (error) {
      logger.error(`Error executing ${taskType} task with ChatGPT:`, error);
      throw new Error(`ChatGPT ${taskType} task failed: ${error.message}`);
    }
  }
  
  // Private methods
  
  _prepareRequestOptions(message, context, options) {
    // Determine if we should use streaming
    const useStreaming = options.stream === true && config.features.enableStreaming;
    
    // Prepare messages array
    const messages = [];
    
    // Add system message if provided
    if (context.systemPrompt) {
      messages.push({
        role: 'system',
        content: context.systemPrompt
      });
    } else {
      // Default system prompt
      messages.push({
        role: 'system',
        content: 'You are a helpful assistant that provides accurate, detailed, and thoughtful responses.'
      });
    }
    
    // Add conversation history if available
    if (context.history && Array.isArray(context.history)) {
      messages.push(...context.history);
    }
    
    // Add current message
    messages.push({
      role: 'user',
      content: message
    });
    
    // Prepare request options
    return {
      model: options.model || this.model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
      top_p: options.topP || 1,
      frequency_penalty: options.frequencyPenalty || 0,
      presence_penalty: options.presencePenalty || 0,
      stream: useStreaming
    };
  }
  
  async _makeApiRequest(endpoint, data) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  }
  
  _processResponse(response, options) {
    // Handle streaming response
    if (options.stream && typeof options.onChunk === 'function') {
      // This would be handled differently in a real implementation
      // as streaming requires processing chunks as they arrive
      return {
        streaming: true,
        platform: 'ChatGPT',
        model: options.model || this.model,
        timestamp: new Date().toISOString()
      };
    }
    
    // Process regular response
    const result = {
      content: response.choices[0].message.content,
      platform: 'ChatGPT',
      model: options.model || this.model,
      usage: response.usage,
      timestamp: new Date().toISOString(),
      taskType: options.taskType
    };
    
    // Add thinking steps if requested
    if (options.includeThinking && options.thinkingSteps) {
      result.thinking = options.thinkingSteps;
    }
    
    return result;
  }
  
  async _executeWithRetry(fn) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this._isRetryableError(error) || attempt === this.maxRetries) {
          throw error;
        }
        
        // Wait before retrying
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        logger.info(`Retrying ChatGPT request (attempt ${attempt}/${this.maxRetries}) after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
  
  _isRetryableError(error) {
    // Determine if an error should be retried
    const status = error.response?.status;
    
    // Retry on rate limiting or server errors
    return status === 429 || (status >= 500 && status < 600);
  }
  
  _checkFallbackAvailability(options) {
    // Check if fallback is available based on options and configuration
    return config.features.enableFallbackChain && 
           !options.noFallback && 
           (!options.attemptedPlatforms || !options.attemptedPlatforms.includes('ChatGPT'));
  }
  
  _suggestFallbackPlatform(error) {
    // Suggest fallback platform based on error type
    const status = error.response?.status;
    
    if (status === 429) {
      // Rate limiting - suggest platforms with higher rate limits
      return ['Gemini', 'DeepSeek'];
    } else if (error.message.includes('content policy')) {
      // Content policy violation - suggest platforms with different policies
      return ['Perplexity', 'DeepSeek'];
    } else if (status >= 500) {
      // Server error - suggest reliable alternatives
      return ['Perplexity', 'Gemini'];
    }
    
    // Default fallbacks
    return ['Perplexity', 'Gemini', 'DeepSeek'];
  }
  
  _getTemperatureForTask(taskType, options) {
    // Set appropriate temperature based on task type
    if (options.temperature !== undefined) {
      return options.temperature;
    }
    
    switch (taskType) {
      case 'extract':
      case 'analyze':
      case 'extractEntities':
        return 0.2; // Lower temperature for factual tasks
      case 'summarize':
        return 0.5; // Moderate temperature for summarization
      case 'deepAnalysis':
        return 0.7; // Higher temperature for creative analysis
      case 'documentQA':
        return 0.3; // Moderate-low temperature for Q&A
      default:
        return 0.7; // Default temperature
    }
  }
  
  // Task-specific prompt constructors
  
  _constructExtractionPrompt(content, options) {
    return `Extract the key information from the following content. Focus on main points, facts, and data.
    
Content:
${content.text}

Extraction format: Provide a structured extraction of the key information.`;
  }
  
  _constructAnalysisPrompt(content, options) {
    return `Analyze the following content. Identify themes, patterns, and insights.
    
Content:
${content.text}

Analysis format: Provide a structured analysis with clear sections for different aspects of the content.`;
  }
  
  _constructSummarizationPrompt(content, options) {
    const length = options.length || 'medium';
    let wordCount;
    
    switch (length) {
      case 'short':
        wordCount = '100-150 words';
        break;
      case 'medium':
        wordCount = '250-350 words';
        break;
      case 'long':
        wordCount = '500-700 words';
        break;
      default:
        wordCount = '250-350 words';
    }
    
    return `Summarize the following content in approximately ${wordCount}.
    
Content:
${content.text}

Summary format: Provide a coherent summary that captures the main points and key details.`;
  }
  
  _constructEntityExtractionPrompt(content, options) {
    return `Extract entities from the following content. Include people, organizations, locations, dates, and other relevant entities.
    
Content:
${content.text}

Extraction format: Provide a structured list of entities categorized by type.`;
  }
  
  _constructDeepAnalysisPrompt(content, options) {
    return `Perform a deep analysis of the following content. Consider context, implications, underlying assumptions, and potential biases.
    
Content:
${content.text}

Analysis format: Provide a comprehensive analysis with sections for context, key points, implications, and critical evaluation.`;
  }
  
  _constructDocumentQAPrompt(content, context, options) {
    return `Answer the following question based on the document content provided.
    
Document content:
${content.text}

Question: ${context.currentQuestion || options.question}

Answer format: Provide a clear, direct answer to the question based solely on the document content. If the answer cannot be determined from the document, state this clearly.`;
  }
  
  _incorporateThinkingSteps(prompt, thinkingSteps) {
    const thinkingContent = thinkingSteps.map((step, index) => 
      `Step ${index + 1}: ${step}`
    ).join('\n');
    
    return `${prompt}

To approach this task, consider the following thinking steps:
${thinkingContent}`;
  }
}

module.exports = new ChatGPTConnector();
