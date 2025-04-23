/**
 * Arabic Document Processing Enhancement for Majd Platform
 * 
 * This module extends document processing capabilities with specialized
 * handling for Arabic language documents.
 */

const { logger } = require('../utils/logger');
const languageService = require('./languageService');
const config = require('../config');

class ArabicDocumentProcessor {
  constructor() {
    this.rtlSupport = true;
    this.arabicOcrEnabled = config.documentProcessing?.ocr?.languages?.includes('ara') || false;
    
    logger.info(`Arabic document processor initialized. OCR support: ${this.arabicOcrEnabled ? 'Enabled' : 'Disabled'}`);
  }
  
  /**
   * Process Arabic document content
   * @param {Object} content - Document content object
   * @param {Object} options - Processing options
   * @returns {Object} Processed content
   */
  processContent(content, options = {}) {
    try {
      if (!content || !content.text) {
        return content;
      }
      
      // Detect if content is Arabic
      const languageInfo = languageService.detectLanguage(content.text);
      
      // Only process if Arabic is detected with reasonable confidence
      if (languageInfo.language !== 'arabic' || languageInfo.confidence < 0.4) {
        return content;
      }
      
      logger.info('Processing Arabic document content');
      
      // Process the text using language service
      const processedText = languageService.processText(content.text, {
        normalize: true,
        removeStopwords: false, // Keep all words for document processing
        stem: false // Don't stem for document processing to preserve meaning
      });
      
      // Update content with processed text
      const processedContent = {
        ...content,
        text: processedText.text,
        originalText: content.text,
        metadata: {
          ...content.metadata,
          language: 'arabic',
          isRightToLeft: true,
          wordCount: processedText.metadata.wordCount
        },
        structure: {
          ...content.structure,
          direction: 'rtl'
        }
      };
      
      return processedContent;
    } catch (error) {
      logger.error('Arabic document processing failed:', error);
      return content; // Return original content on error
    }
  }
  
  /**
   * Enhance OCR for Arabic text in images
   * @param {Buffer} imageBuffer - Image buffer
   * @param {Object} options - OCR options
   * @returns {Object} Enhanced OCR options
   */
  enhanceOcrForArabic(imageBuffer, options = {}) {
    // Set optimal OCR parameters for Arabic
    return {
      ...options,
      lang: 'ara',
      oem: 1, // LSTM only
      psm: 6, // Assume a single uniform block of text
      dpi: 300, // Higher DPI for Arabic characters
      preprocess: true, // Enable preprocessing
      preprocessingSteps: [
        'grayscale',
        'threshold',
        'dilate',
        'erode'
      ]
    };
  }
  
  /**
   * Format Arabic document for display
   * @param {Object} document - Document object
   * @returns {Object} Formatted document
   */
  formatForDisplay(document) {
    try {
      if (!document) return document;
      
      // Check if document is in Arabic
      const isArabic = document.metadata?.language === 'arabic' || 
                      (document.text && languageService.detectLanguage(document.text).language === 'arabic');
      
      if (!isArabic) return document;
      
      // Format for display
      return {
        ...document,
        direction: 'rtl',
        formattedText: this._formatArabicDocumentText(document.text),
        displayMetadata: {
          ...document.metadata,
          isRightToLeft: true,
          language: 'Arabic',
          languageNative: 'العربية'
        }
      };
    } catch (error) {
      logger.error('Arabic document formatting failed:', error);
      return document; // Return original document on error
    }
  }
  
  /**
   * Generate Arabic document
   * @param {Object} content - Content to generate document from
   * @param {Object} options - Generation options
   * @returns {Object} Generation result
   */
  generateArabicDocument(content, options = {}) {
    try {
      logger.info('Generating Arabic document');
      
      // Set Arabic-specific generation options
      const arabicOptions = {
        ...options,
        direction: 'rtl',
        fontFamily: options.fontFamily || 'Traditional Arabic, Arial, sans-serif',
        fontSize: options.fontSize || '16pt',
        lineHeight: options.lineHeight || 1.8, // Increased for better Arabic readability
        textAlign: options.textAlign || 'right'
      };
      
      // Format content for Arabic document
      const formattedContent = this._prepareArabicContent(content);
      
      return {
        content: formattedContent,
        options: arabicOptions,
        language: 'arabic',
        direction: 'rtl'
      };
    } catch (error) {
      logger.error('Arabic document generation failed:', error);
      throw new Error(`Arabic document generation failed: ${error.message}`);
    }
  }
  
  // Private helper methods
  
  /**
   * Format Arabic document text for display
   * @private
   */
  _formatArabicDocumentText(text) {
    if (!text) return text;
    
    // Apply Arabic-specific formatting
    return languageService._formatArabicText(text);
  }
  
  /**
   * Prepare content for Arabic document generation
   * @private
   */
  _prepareArabicContent(content) {
    if (typeof content === 'string') {
      // Format simple string content
      return languageService._formatArabicText(content);
    } else if (typeof content === 'object') {
      // Format structured content
      const formatted = { ...content };
      
      // Format text fields
      if (formatted.title) {
        formatted.title = languageService._formatArabicText(formatted.title);
      }
      
      if (formatted.body) {
        formatted.body = languageService._formatArabicText(formatted.body);
      }
      
      if (formatted.sections && Array.isArray(formatted.sections)) {
        formatted.sections = formatted.sections.map(section => ({
          ...section,
          title: section.title ? languageService._formatArabicText(section.title) : section.title,
          content: section.content ? languageService._formatArabicText(section.content) : section.content
        }));
      }
      
      return formatted;
    }
    
    return content;
  }
}

module.exports = new ArabicDocumentProcessor();
