/**
 * GitHub Copilot Platform Module for Majd Platform
 * 
 * This module handles integration with the GitHub Copilot API,
 * providing access to Copilot's code generation and autonomous coding capabilities.
 */

const axios = require('axios');
const { logger } = require('../utils/logger');
const config = require('../config');

class CopilotModule {
  constructor() {
    this.apiKey = config.GITHUB_COPILOT_API_KEY;
    this.apiUrl = 'https://api.github.com/copilot/v1/chat/completions';
    this.model = config.GITHUB_COPILOT_MODEL || 'copilot-4';
    this.defaultTemperature = 0.3; // Lower temperature for more precise code generation
    this.defaultMaxTokens = 4096;
  }

  /**
   * Generate a response using the GitHub Copilot API
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The API response
   */
  async generateResponse(prompt, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('GitHub Copilot API key not configured');
      }

      // Prepare request payload
      const payload = {
        model: options.model || this.model,
        messages: prompt.messages,
        temperature: options.temperature || this.defaultTemperature,
        max_tokens: options.maxTokens || this.defaultMaxTokens,
        top_p: options.topP || 1,
        n: options.n || 1
      };

      // Add editor context if available
      if (prompt.editor_context) {
        payload.editor_context = prompt.editor_context;
      }

      // Make API request
      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        timeout: options.timeout || 60000 // 60 seconds default timeout
      });

      logger.debug('GitHub Copilot response received', {
        model: payload.model,
        hasEditorContext: !!prompt.editor_context
      });

      return response.data;
    } catch (error) {
      logger.error('Error generating GitHub Copilot response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`GitHub Copilot API error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }

  /**
   * Generate a streaming response using the GitHub Copilot API
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Function} onChunk - Callback for each chunk of the response
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The complete response after streaming
   */
  async generateStreamingResponse(prompt, onChunk, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('GitHub Copilot API key not configured');
      }

      // Prepare request payload
      const payload = {
        model: options.model || this.model,
        messages: prompt.messages,
        temperature: options.temperature || this.defaultTemperature,
        max_tokens: options.maxTokens || this.defaultMaxTokens,
        top_p: options.topP || 1,
        n: options.n || 1,
        stream: true
      };

      // Add editor context if available
      if (prompt.editor_context) {
        payload.editor_context = prompt.editor_context;
      }

      // Make streaming API request
      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
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
            logger.error('Error processing GitHub Copilot stream chunk', error);
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
          logger.error('Error in GitHub Copilot stream', error);
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Error generating GitHub Copilot streaming response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`GitHub Copilot API streaming error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }
}

// Export singleton instance
module.exports = new CopilotModule();
