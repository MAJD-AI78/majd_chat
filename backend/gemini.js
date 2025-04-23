/**
 * Gemini Platform Module for Majd Platform
 * 
 * This module handles integration with the Google Gemini API,
 * providing access to Gemini's advanced reasoning and multimodal capabilities.
 */

const axios = require('axios');
const { logger } = require('../utils/logger');
const config = require('../config');

class GeminiModule {
  constructor() {
    this.apiKey = config.GEMINI_API_KEY;
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = config.GEMINI_MODEL || 'gemini-1.5-pro';
    this.defaultTemperature = 0.7;
    this.defaultMaxOutputTokens = 8192;
  }

  /**
   * Generate a response using the Gemini API
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The API response
   */
  async generateResponse(prompt, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Gemini API key not configured');
      }

      const model = options.model || this.model;
      const endpoint = `${this.apiUrl}/${model}:generateContent?key=${this.apiKey}`;

      // Prepare request payload
      const payload = {
        contents: prompt.contents,
        generationConfig: {
          temperature: options.temperature || this.defaultTemperature,
          maxOutputTokens: options.maxOutputTokens || this.defaultMaxOutputTokens,
          topP: options.topP || 0.95,
          topK: options.topK || 40
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      // Make API request
      const response = await axios.post(endpoint, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: options.timeout || 60000 // 60 seconds default timeout
      });

      logger.debug('Gemini response received', {
        model: model,
        promptSize: JSON.stringify(prompt.contents).length
      });

      return response.data;
    } catch (error) {
      logger.error('Error generating Gemini response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`Gemini API error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }

  /**
   * Generate a streaming response using the Gemini API
   * 
   * @param {Object} prompt - The formatted prompt
   * @param {Function} onChunk - Callback for each chunk of the response
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - The complete response after streaming
   */
  async generateStreamingResponse(prompt, onChunk, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Gemini API key not configured');
      }

      const model = options.model || this.model;
      const endpoint = `${this.apiUrl}/${model}:streamGenerateContent?key=${this.apiKey}`;

      // Prepare request payload
      const payload = {
        contents: prompt.contents,
        generationConfig: {
          temperature: options.temperature || this.defaultTemperature,
          maxOutputTokens: options.maxOutputTokens || this.defaultMaxOutputTokens,
          topP: options.topP || 0.95,
          topK: options.topK || 40
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      // Make streaming API request
      const response = await axios.post(endpoint, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        responseType: 'stream',
        timeout: options.timeout || 120000 // 120 seconds default timeout for streaming
      });

      // Process the stream
      let fullContent = '';
      let candidates = [];

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          try {
            const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
              // Skip empty lines
              if (line.trim() === '') continue;
              
              // Parse JSON
              const json = JSON.parse(line);
              
              if (json.candidates && json.candidates.length > 0) {
                const candidate = json.candidates[0];
                
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                  const content = candidate.content.parts[0].text || '';
                  fullContent += content;
                  
                  // Call the chunk callback
                  if (onChunk && typeof onChunk === 'function') {
                    onChunk(content, json);
                  }
                }
                
                // Save candidate information
                candidates.push(candidate);
              }
            }
          } catch (error) {
            logger.error('Error processing Gemini stream chunk', error);
          }
        });

        response.data.on('end', () => {
          // Construct final response object
          const finalResponse = {
            candidates: [{
              content: {
                parts: [{
                  text: fullContent
                }],
                role: 'model'
              },
              finishReason: 'STOP',
              index: 0,
              safetyRatings: candidates.length > 0 ? candidates[candidates.length - 1].safetyRatings : []
            }],
            promptFeedback: candidates.length > 0 ? candidates[candidates.length - 1].promptFeedback : {}
          };
          
          resolve(finalResponse);
        });

        response.data.on('error', (error) => {
          logger.error('Error in Gemini stream', error);
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Error generating Gemini streaming response', error);
      
      // Enhance error with more details
      const enhancedError = new Error(`Gemini API streaming error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;
      
      throw enhancedError;
    }
  }
}

// Export singleton instance
module.exports = new GeminiModule();
