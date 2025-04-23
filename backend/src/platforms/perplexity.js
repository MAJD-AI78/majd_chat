/**
 * Perplexity Platform Module for Majd Platform
 * 
 * This module handles integration with the Perplexity AI API,
 * providing access to Perplexity's research and information synthesis capabilities.
 */

const axios = require('axios');
const { logger } = require('../utils/logger');
const config = require('../config');

class PerplexityModule {
  constructor() {
    this.apiKey = config.PERPLEXITY_API_KEY;
    this.apiUrl = 'https://api.perplexity.ai/chat/completions';
    this.model = config.PERPLEXITY_MODEL || 'sonar-medium-online';
    this.defaultTemperature = 0.5;
    this.defaultMaxTokens = 2048;
  }

  /**
   * Generate a response using the Perplexity API
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The API response
   */
  async generateResponse(prompt, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Perplexity API key not configured');
      }

      // Prepare request payload
      const payload = {
        model: options.model || this.model,
        messages: prompt.messages,
        temperature: options.temperature || this.defaultTemperature,
        max_tokens: options.maxTokens || this.defaultMaxTokens,
        search: prompt.search !== undefined ? prompt.search : true,
        include_citations: prompt.include_citations !== undefined ? prompt.include_citations : true
      };

      // Make API request
      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: options.timeout || 60000 // 60 seconds default timeout
      });

      logger.debug('Perplexity response received', {
        model: payload.model,
        search: payload.search,
        include_citations: payload.include_citations
      });

      return response.data;
    } catch (error) {
      logger.error('Error generating Perplexity response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`Perplexity API error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }

  /**
   * Generate a streaming response using the Perplexity API
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Function} onChunk - Callback for each chunk of the response
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The complete response after streaming
   */
  async generateStreamingResponse(prompt, onChunk, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Perplexity API key not configured');
      }

      // Prepare request payload
      const payload = {
        model: options.model || this.model,
        messages: prompt.messages,
        temperature: options.temperature || this.defaultTemperature,
        max_tokens: options.maxTokens || this.defaultMaxTokens,
        search: prompt.search !== undefined ? prompt.search : true,
        include_citations: prompt.include_citations !== undefined ? prompt.include_citations : true,
        stream: true
      };

      // Make streaming API request
      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream',
        timeout: options.timeout || 120000 // 120 seconds default timeout for streaming
      });

      // Process the stream
      let fullResponse = '';
      let citations = [];
      let responseObject = null;

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          try {
            const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
              // Skip empty lines and "[DONE]" marker
              if (line.trim() === '' || line.includes('[DONE]')) continue;
              
              // Remove "data: " prefix
              const jsonStr = line.replace(/^data: /, '').trim();
              if (!jsonStr) continue;
              
              // Parse JSON
              const json = JSON.parse(jsonStr);
              
              // Extract content
              if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                const content = json.choices[0].delta.content;
                fullResponse += content;
                
                // Call the chunk callback
                if (onChunk && typeof onChunk === 'function') {
                  onChunk(content, json);
                }
              }
              
              // Extract citations if available
              if (json.citations) {
                citations = [...citations, ...json.citations];
              }
              
              // Save the last response object
              responseObject = json;
            }
          } catch (error) {
            logger.error('Error processing Perplexity stream chunk', error);
          }
        });

        response.data.on('end', () => {
          // Construct final response object
          const finalResponse = {
            id: responseObject?.id || 'unknown',
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: payload.model,
            choices: [{
              message: {
                role: 'assistant',
                content: fullResponse
              },
              finish_reason: 'stop',
              index: 0
            }],
            citations: citations,
            usage: {
              prompt_tokens: -1, // Unknown in streaming mode
              completion_tokens: -1, // Unknown in streaming mode
              total_tokens: -1 // Unknown in streaming mode
            }
          };
          
          resolve(finalResponse);
        });

        response.data.on('error', (error) => {
          logger.error('Error in Perplexity stream', error);
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Error generating Perplexity streaming response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`Perplexity API streaming error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }
}

// Export singleton instance
module.exports = new PerplexityModule();
