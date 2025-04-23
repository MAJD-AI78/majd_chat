/**
 * Grok3 Platform Module for Majd Platform
 * 
 * This module handles integration with the Grok3 API,
 * providing access to Grok3's real-time data analysis and interpretation capabilities.
 */

const axios = require('axios');
const { logger } = require('../utils/logger');
const config = require('../config');

class Grok3Module {
  constructor() {
    this.apiKey = config.GROK3_API_KEY;
    this.apiUrl = 'https://api.grok.x/v1/chat/completions';
    this.model = config.GROK3_MODEL || 'grok-3';
    this.defaultTemperature = 0.7;
    this.defaultMaxTokens = 4096;
  }

  /**
   * Generate a response using the Grok3 API
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The API response
   */
  async generateResponse(prompt, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Grok3 API key not configured');
      }

      // Prepare request payload
      const payload = {
        model: options.model || this.model,
        messages: prompt.messages,
        temperature: options.temperature || this.defaultTemperature,
        max_tokens: options.maxTokens || this.defaultMaxTokens,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
        use_realtime_data: prompt.use_realtime_data !== undefined ? prompt.use_realtime_data : true
      };

      // Make API request
      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: options.timeout || 60000 // 60 seconds default timeout
      });

      logger.debug('Grok3 response received', {
        model: payload.model,
        useRealtimeData: payload.use_realtime_data
      });

      return response.data;
    } catch (error) {
      logger.error('Error generating Grok3 response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`Grok3 API error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }

  /**
   * Generate a streaming response using the Grok3 API
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Function} onChunk - Callback for each chunk of the response
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The complete response after streaming
   */
  async generateStreamingResponse(prompt, onChunk, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Grok3 API key not configured');
      }

      // Prepare request payload
      const payload = {
        model: options.model || this.model,
        messages: prompt.messages,
        temperature: options.temperature || this.defaultTemperature,
        max_tokens: options.maxTokens || this.defaultMaxTokens,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
        use_realtime_data: prompt.use_realtime_data !== undefined ? prompt.use_realtime_data : true,
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
      let fullContent = '';
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
                fullContent += content;
                
                // Call the chunk callback
                if (onChunk && typeof onChunk === 'function') {
                  onChunk(content, json);
                }
              }
              
              // Save the last response object
              responseObject = json;
            }
          } catch (error) {
            logger.error('Error processing Grok3 stream chunk', error);
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
                content: fullContent
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
          logger.error('Error in Grok3 stream', error);
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Error generating Grok3 streaming response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`Grok3 API streaming error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }
}

// Export singleton instance
module.exports = new Grok3Module();
