/**
 * Local Model Module for Majd Platform
 * 
 * This module handles integration with locally deployed models,
 * providing fallback capabilities and cost optimization.
 */

const axios = require('axios');
const { logger } = require('../utils/logger');
const config = require('../config');

class LocalModule {
  constructor() {
    this.localEndpoint = config.LOCAL_MODEL_ENDPOINT || 'http://localhost:8000/v1/chat/completions';
    this.model = config.LOCAL_MODEL || 'deepseek-r1-distill-qwen-7b';
    this.defaultTemperature = 0.7;
    this.defaultMaxTokens = 2048;
  }

  /**
   * Generate a response using the local model
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The API response
   */
  async generateResponse(prompt, options = {}) {
    try {
      // Prepare request payload
      const payload = {
        model: options.model || this.model,
        messages: prompt.messages,
        temperature: options.temperature || this.defaultTemperature,
        max_tokens: options.maxTokens || this.defaultMaxTokens,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0
      };

      // Make API request to local endpoint
      const response = await axios.post(this.localEndpoint, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: options.timeout || 60000 // 60 seconds default timeout
      });

      logger.debug('Local model response received', {
        model: payload.model
      });

      return response.data;
    } catch (error) {
      logger.error('Error generating local model response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`Local model error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }

  /**
   * Generate a streaming response using the local model
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Function} onChunk - Callback for each chunk of the response
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The complete response after streaming
   */
  async generateStreamingResponse(prompt, onChunk, options = {}) {
    try {
      // Prepare request payload
      const payload = {
        model: options.model || this.model,
        messages: prompt.messages,
        temperature: options.temperature || this.defaultTemperature,
        max_tokens: options.maxTokens || this.defaultMaxTokens,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
        stream: true
      };

      // Make streaming API request to local endpoint
      const response = await axios.post(this.localEndpoint, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        responseType: 'stream',
        timeout: options.timeout || 120000 // 120 seconds default timeout for streaming
      });

      // Process the stream
      let fullResponse = '';
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
              
              // Save the last response object
              responseObject = json;
            }
          } catch (error) {
            logger.error('Error processing local model stream chunk', error);
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
            usage: {
              prompt_tokens: -1, // Unknown in streaming mode
              completion_tokens: -1, // Unknown in streaming mode
              total_tokens: -1 // Unknown in streaming mode
            }
          };
          
          resolve(finalResponse);
        });

        response.data.on('error', (error) => {
          logger.error('Error in local model stream', error);
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Error generating local model streaming response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`Local model streaming error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }
}

// Export singleton instance
module.exports = new LocalModule();
