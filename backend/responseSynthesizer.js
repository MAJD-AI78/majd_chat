/**
 * Response Synthesizer Component for Majd Platform
 * 
 * This component is responsible for processing responses from different AI platforms,
 * merging them when necessary, ensuring consistency, and formatting the final
 * response for the user.
 */

const { logger } = require('../utils/logger');
const { ThinkingEngine } = require('./thinkingEngine');
const config = require('../config');

class ResponseSynthesizer {
  constructor() {
    this.thinkingEngine = new ThinkingEngine();
    this.responseFormats = {
      TEXT: 'text',
      MARKDOWN: 'markdown',
      HTML: 'html',
      JSON: 'json'
    };
  }

  /**
   * Process a response from an AI platform
   * 
   * @param {Object} response - The response from the AI platform
   * @param {Object} requestInfo - Information about the original request
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - The processed response
   */
  async processResponse(response, requestInfo, options = {}) {
    try {
      // Extract basic response information
      const processedResponse = {
        originalResponse: response,
        platform: requestInfo.platform,
        taskType: requestInfo.taskType,
        timestamp: new Date().toISOString(),
        userId: requestInfo.userId,
        format: options.format || this.responseFormats.MARKDOWN
      };
      
      // Extract the content based on platform
      processedResponse.content = this.extractContent(response, requestInfo.platform);
      
      // Extract thinking process if available
      if (options.extractThinking && requestInfo.thinkingPrompts) {
        processedResponse.thinkingProcess = this.thinkingEngine.extractThinkingProcess(
          processedResponse.content,
          requestInfo.thinkingPrompts
        );
      }
      
      // Format the response based on requested format
      processedResponse.formattedResponse = this.formatResponse(
        processedResponse.content,
        processedResponse.thinkingProcess,
        processedResponse.format,
        options
      );
      
      return processedResponse;
    } catch (error) {
      logger.error('Error processing response', error);
      
      // Return a basic processed response in case of error
      return {
        content: 'I encountered an issue processing the response. Please try again.',
        platform: requestInfo.platform,
        taskType: requestInfo.taskType,
        timestamp: new Date().toISOString(),
        userId: requestInfo.userId,
        format: options.format || this.responseFormats.MARKDOWN,
        error: error.message,
        formattedResponse: 'I encountered an issue processing the response. Please try again.'
      };
    }
  }

  /**
   * Extract content from platform-specific response
   * 
   * @param {Object} response - The response from the AI platform
   * @param {string} platform - The AI platform
   * @returns {string} - The extracted content
   */
  extractContent(response, platform) {
    switch (platform) {
      case 'chatgpt':
        return this.extractChatGPTContent(response);
      case 'perplexity':
        return this.extractPerplexityContent(response);
      case 'gemini':
        return this.extractGeminiContent(response);
      case 'copilot':
        return this.extractCopilotContent(response);
      case 'deepseek':
        return this.extractDeepSeekContent(response);
      case 'grok3':
        return this.extractGrok3Content(response);
      case 'vertix':
        return this.extractVertixContent(response);
      case 'local':
        return this.extractLocalContent(response);
      default:
        return typeof response === 'string' ? response : JSON.stringify(response);
    }
  }

  /**
   * Extract content from ChatGPT response
   * 
   * @param {Object} response - The ChatGPT response
   * @returns {string} - The extracted content
   */
  extractChatGPTContent(response) {
    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content;
    }
    return typeof response === 'string' ? response : JSON.stringify(response);
  }

  /**
   * Extract content from Perplexity response
   * 
   * @param {Object} response - The Perplexity response
   * @returns {string} - The extracted content
   */
  extractPerplexityContent(response) {
    if (response.answer) {
      let content = response.answer.text;
      
      // Add citations if available
      if (response.answer.citations && response.answer.citations.length > 0) {
        content += '\n\n**Sources:**\n';
        response.answer.citations.forEach((citation, index) => {
          content += `${index + 1}. [${citation.title}](${citation.url})\n`;
        });
      }
      
      return content;
    }
    return typeof response === 'string' ? response : JSON.stringify(response);
  }

  /**
   * Extract content from Gemini response
   * 
   * @param {Object} response - The Gemini response
   * @returns {string} - The extracted content
   */
  extractGeminiContent(response) {
    if (response.candidates && response.candidates.length > 0) {
      return response.candidates[0].content.parts[0].text;
    }
    return typeof response === 'string' ? response : JSON.stringify(response);
  }

  /**
   * Extract content from GitHub Copilot response
   * 
   * @param {Object} response - The Copilot response
   * @returns {string} - The extracted content
   */
  extractCopilotContent(response) {
    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content;
    }
    return typeof response === 'string' ? response : JSON.stringify(response);
  }

  /**
   * Extract content from DeepSeek response
   * 
   * @param {Object} response - The DeepSeek response
   * @returns {string} - The extracted content
   */
  extractDeepSeekContent(response) {
    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content;
    }
    return typeof response === 'string' ? response : JSON.stringify(response);
  }

  /**
   * Extract content from Grok3 response
   * 
   * @param {Object} response - The Grok3 response
   * @returns {string} - The extracted content
   */
  extractGrok3Content(response) {
    if (response.output && response.output.content) {
      return response.output.content;
    }
    return typeof response === 'string' ? response : JSON.stringify(response);
  }

  /**
   * Extract content from Vertix response
   * 
   * @param {Object} response - The Vertix response
   * @returns {string} - The extracted content
   */
  extractVertixContent(response) {
    if (response.content) {
      return response.content;
    }
    return typeof response === 'string' ? response : JSON.stringify(response);
  }

  /**
   * Extract content from local model response
   * 
   * @param {Object} response - The local model response
   * @returns {string} - The extracted content
   */
  extractLocalContent(response) {
    if (response.output) {
      return response.output;
    }
    return typeof response === 'string' ? response : JSON.stringify(response);
  }

  /**
   * Format the response based on requested format
   * 
   * @param {string} content - The response content
   * @param {Object} thinkingProcess - The extracted thinking process
   * @param {string} format - The requested format
   * @param {Object} options - Formatting options
   * @returns {string} - The formatted response
   */
  formatResponse(content, thinkingProcess, format, options = {}) {
    // Add platform attribution if required
    const attribution = options.includeAttribution ? this.generateAttribution(options.platform) : '';
    
    // Format thinking process if available
    const formattedThinking = thinkingProcess && options.includeThinking
      ? this.thinkingEngine.formatThinkingProcess(thinkingProcess, { format })
      : '';
    
    // Combine content based on format
    switch (format) {
      case this.responseFormats.MARKDOWN:
        return this.formatMarkdown(content, formattedThinking, attribution, options);
      case this.responseFormats.HTML:
        return this.formatHTML(content, formattedThinking, attribution, options);
      case this.responseFormats.JSON:
        return this.formatJSON(content, thinkingProcess, options);
      default:
        return content + (attribution ? `\n\n${attribution}` : '');
    }
  }

  /**
   * Format response as Markdown
   * 
   * @param {string} content - The response content
   * @param {string} thinking - The formatted thinking process
   * @param {string} attribution - The platform attribution
   * @param {Object} options - Formatting options
   * @returns {string} - The Markdown-formatted response
   */
  formatMarkdown(content, thinking, attribution, options = {}) {
    let markdown = '';
    
    // Add thinking process before or after content based on options
    if (thinking && options.thinkingPosition === 'before') {
      markdown += thinking + '\n\n';
    }
    
    // Add main content
    markdown += content;
    
    // Add thinking process after content
    if (thinking && (!options.thinkingPosition || options.thinkingPosition === 'after')) {
      markdown += '\n\n' + thinking;
    }
    
    // Add attribution
    if (attribution) {
      markdown += '\n\n' + attribution;
    }
    
    return markdown;
  }

  /**
   * Format response as HTML
   * 
   * @param {string} content - The response content
   * @param {string} thinking - The formatted thinking process
   * @param {string} attribution - The platform attribution
   * @param {Object} options - Formatting options
   * @returns {string} - The HTML-formatted response
   */
  formatHTML(content, thinking, attribution, options = {}) {
    let html = '<div class="majd-response">';
    
    // Add thinking process before or after content based on options
    if (thinking && options.thinkingPosition === 'before') {
      html += thinking;
    }
    
    // Add main content
    html += `<div class="response-content">${this.markdownToHTML(content)}</div>`;
    
    // Add thinking process after content
    if (thinking && (!options.thinkingPosition || options.thinkingPosition === 'after')) {
      html += thinking;
    }
    
    // Add attribution
    if (attribution) {
      html += `<div class="attribution">${attribution}</div>`;
    }
    
    html += '</div>';
    return html;
  }

  /**
   * Format response as JSON
   * 
   * @param {string} content - The response content
   * @param {Object} thinkingProcess - The thinking process object
   * @param {Object} options - Formatting options
   * @returns {string} - The JSON-formatted response
   */
  formatJSON(content, thinkingProcess, options = {}) {
    const responseObj = {
      content,
      timestamp: new Date().toISOString()
    };
    
    // Add thinking process if available
    if (thinkingProcess) {
      responseObj.thinking_process = thinkingProcess;
    }
    
    // Add platform information if attribution is required
    if (options.includeAttribution) {
      responseObj.platform = options.platform;
    }
    
    return JSON.stringify(responseObj, null, 2);
  }

  /**
   * Generate attribution for the AI platform
   * 
   * @param {string} platform - The AI platform
   * @returns {string} - The attribution text
   */
  generateAttribution(platform) {
    if (!platform) return '';
    
    const attributions = {
      'chatgpt': '*Response powered by ChatGPT*',
      'perplexity': '*Response powered by Perplexity AI*',
      'gemini': '*Response powered by Google Gemini*',
      'copilot': '*Response powered by GitHub Copilot*',
      'deepseek': '*Response powered by DeepSeek*',
      'grok3': '*Response powered by Grok3*',
      'vertix': '*Response powered by Vertix*',
      'local': '*Response powered by Majd local models*'
    };
    
    return attributions[platform] || '';
  }

  /**
   * Convert Markdown to HTML (simple implementation)
   * 
   * @param {string} markdown - The Markdown content
   * @returns {string} - The HTML content
   */
  markdownToHTML(markdown) {
    if (!markdown) return '';
    
    // This is a very simplified conversion - in production, use a proper Markdown library
    let html = markdown
      // Headers
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```(.*?)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
      // Inline code
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Links
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
      // Lists
      .replace(/^\s*\d+\.\s+(.*$)/gm, '<li>$1</li>')
      .replace(/^\s*[\-\*]\s+(.*$)/gm, '<li>$1</li>')
      // Paragraphs
      .replace(/\n\s*\n/g, '</p><p>');
    
    // Wrap in paragraph tags if not already
    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }
    
    return html;
  }

  /**
   * Merge responses from multiple platforms
   * 
   * @param {Array} responses - Array of processed responses
   * @param {Object} options - Merging options
   * @returns {Promise<Object>} - The merged response
   */
  async mergeResponses(responses, options = {}) {
    try {
      if (!responses || responses.length === 0) {
        throw new Error('No responses to merge');
      }
      
      if (responses.length === 1) {
        return responses[0];
      }
      
      // Default to the first response's format
      const format = options.format || responses[0].format || this.responseFormats.MARKDOWN;
      
      // Create merged response object
      const mergedResponse = {
        platform: 'merged',
        taskType: responses[0].taskType,
        timestamp: new Date().toISOString(),
        userId: responses[0].userId,
        format,
        sources: responses.map(r => ({
          platform: r.platform,
          taskType: r.taskType
        }))
      };
      
      // Merge content based on merge strategy
      const mergeStrategy = options.mergeStrategy || 'sequential';
      
      switch (mergeStrategy) {
        case 'sequential':
          mergedResponse.content = this.mergeSequential(responses, options);
          break;
        case 'best_first':
          mergedResponse.content = this.mergeBestFirst(responses, options);
          break;
        case 'task_specific':
          mergedResponse.content = this.mergeTaskSpecific(responses, options);
          break;
        default:
          mergedResponse.content = this.mergeSequential(responses, options);
      }
      
      // Format the merged response
      mergedResponse.formattedResponse = this.formatResponse(
        mergedResponse.content,
        null, // No thinking process for merged response
        format,
        { ...options, platform: 'merged' }
      );
      
      return mergedResponse;
    } catch (error) {
      logger.error('Error merging responses', error);
      
      // Return a basic merged response in case of error
      return {
        content: 'I encountered an issue merging the responses. Please try again.',
        platform: 'merged',
        taskType: responses[0]?.taskType || 'unknown',
        timestamp: new Date().toISOString(),
        userId: responses[0]?.userId || 'unknown',
        format: options.format || this.responseFormats.MARKDOWN,
        error: error.message,
        formattedResponse: 'I encountered an issue merging the responses. Please try again.'
      };
    }
  }

  /**
   * Merge responses sequentially
   * 
   * @param {Array} responses - Array of processed responses
   * @param {Object} options - Merging options
   * @returns {string} - The merged content
   */
  mergeSequential(responses, options = {}) {
    let mergedContent = '';
    
    responses.forEach((response, index) => {
      // Add section head
(Content truncated due to size limit. Use line ranges to read in chunks)