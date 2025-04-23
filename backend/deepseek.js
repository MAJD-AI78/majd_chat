/**
 * DeepSeek Platform Module for Majd Platform
 * 
 * This module handles integration with the DeepSeek AI API,
 * providing access to DeepSeek's mathematical reasoning and problem-solving capabilities.
 * It also supports local deployment of DeepSeek models.
 */

const axios = require('axios');
const { logger } = require('../utils/logger');
const config = require('../config');

class DeepSeekModule {
  constructor() {
    this.apiKey = config.DEEPSEEK_API_KEY;
    this.apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    this.model = config.DEEPSEEK_MODEL || 'deepseek-r1-plus';
    this.defaultTemperature = 0.2; // Lower temperature for more precise reasoning
    this.defaultMaxTokens = 4096;
    this.localModelEndpoint = config.DEEPSEEK_LOCAL_ENDPOINT || 'http://localhost:8000/v1/chat/completions';
    this.useLocalModel = config.USE_DEEPSEEK_LOCAL_MODEL || false;
  }

  /**
   * Generate a response using the DeepSeek API
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The API response
   */
  async generateResponse(prompt, options = {}) {
    try {
      // Determine if we should use local model
      const useLocal = options.useLocalModel !== undefined ? options.useLocalModel : this.useLocalModel;
      
      if (useLocal) {
        return this.generateLocalResponse(prompt, options);
      }
      
      if (!this.apiKey) {
        throw new Error('DeepSeek API key not configured');
      }

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

      // Make API request
      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: options.timeout || 60000 // 60 seconds default timeout
      });

      logger.debug('DeepSeek response received', {
        model: payload.model,
        useLocal: false
      });

      return response.data;
    } catch (error) {
      logger.error('Error generating DeepSeek response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`DeepSeek API error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }

  /**
   * Generate a response using a local DeepSeek model
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The API response
   */
  async generateLocalResponse(prompt, options = {}) {
    try {
      // Prepare request payload
      const payload = {
        model: options.localModel || 'deepseek-r1-distill-qwen-7b',
        messages: prompt.messages,
        temperature: options.temperature || this.defaultTemperature,
        max_tokens: options.maxTokens || this.defaultMaxTokens,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0
      };

      // Make API request to local endpoint
      const response = await axios.post(this.localModelEndpoint, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: options.timeout || 60000 // 60 seconds default timeout
      });

      logger.debug('DeepSeek local response received', {
        model: payload.model,
        useLocal: true
      });

      return response.data;
    } catch (error) {
      logger.error('Error generating DeepSeek local response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`DeepSeek local API error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }

  /**
   * Generate a streaming response using the DeepSeek API
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Function} onChunk - Callback for each chunk of the response
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The complete response after streaming
   */
  async generateStreamingResponse(prompt, onChunk, options = {}) {
    try {
      // Determine if we should use local model
      const useLocal = options.useLocalModel !== undefined ? options.useLocalModel : this.useLocalModel;
      
      if (useLocal) {
        return this.generateLocalStreamingResponse(prompt, onChunk, options);
      }
      
      if (!this.apiKey) {
        throw new Error('DeepSeek API key not configured');
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
            logger.error('Error processing DeepSeek stream chunk', error);
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
          logger.error('Error in DeepSeek stream', error);
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Error generating DeepSeek streaming response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`DeepSeek API streaming error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }

  /**
   * Generate a streaming response using a local DeepSeek model
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Function} onChunk - Callback for each chunk of the response
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The complete response after streaming
   */
  async generateLocalStreamingResponse(prompt, onChunk, options = {}) {
    try {
      // Prepare request payload
      const payload = {
        model: options.localModel || 'deepseek-r1-distill-qwen-7b',
        messages: prompt.messages,
        temperature: options.temperature || this.defaultTemperature,
        max_tokens: options.maxTokens || this.defaultMaxTokens,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
        stream: true
      };

      // Make streaming API request to local endpoint
      const response = await axios.post(this.localModelEndpoint, payload, {
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
            logger.error('Error processing DeepSeek local stream chunk', error);
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
          logger.error('Error in DeepSeek local stream', error);
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Error generating DeepSeek local streaming response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`DeepSeek local API streaming error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }
}

// Export singleton instance
module.exports = new DeepSeekModule();
