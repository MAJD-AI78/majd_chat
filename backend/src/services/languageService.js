/**
 * Multilingual Support Service for Majd Platform
 * 
 * This service provides enhanced language detection, processing, and handling
 * with special focus on Arabic language support.
 */

const franc = require('franc');
const LanguageDetect = require('languagedetect');
const arabicNormalizer = require('arabic-normalizer');
const arabicStopwords = require('arabic-stopwords');
const arabicStemmer = require('arabic-stemmer');
const { logger } = require('../utils/logger');
const config = require('../config');

class LanguageService {
  constructor() {
    this.languageDetector = new LanguageDetect();
    this.supportedLanguages = config.languages.supported || ['english', 'arabic', 'french', 'spanish', 'german', 'chinese'];
    this.rtlLanguages = config.languages.rtl || ['arabic', 'hebrew', 'urdu', 'farsi', 'persian'];
    
    logger.info(`Language service initialized with ${this.supportedLanguages.length} supported languages`);
  }
  
  /**
   * Detect the language of a text
   * @param {string} text - The text to analyze
   * @returns {Object} Language detection results
   */
  detectLanguage(text) {
    try {
      if (!text || typeof text !== 'string') {
        return {
          language: config.languages.default || 'english',
          confidence: 0,
          isRightToLeft: false
        };
      }
      
      // Use multiple detection methods for better accuracy
      const francResult = franc(text, { minLength: 10 });
      const langDetectResult = this.languageDetector.detect(text, 2);
      
      // Map franc ISO 639-3 codes to our language names
      const francLanguage = this._mapFrancCodeToLanguage(francResult);
      
      // Get language from languagedetect
      const ldLanguage = langDetectResult.length > 0 ? langDetectResult[0][0].toLowerCase() : null;
      
      // Determine final language with confidence
      let language, confidence;
      
      // If both methods agree, high confidence
      if (francLanguage === ldLanguage) {
        language = francLanguage;
        confidence = langDetectResult.length > 0 ? langDetectResult[0][1] : 0.5;
      } 
      // If franc detects Arabic with high confidence, prefer it (better for Arabic)
      else if (francLanguage === 'arabic' && francResult !== 'und') {
        language = 'arabic';
        confidence = 0.8;
      }
      // Otherwise use languagedetect result if available
      else if (ldLanguage && this._isSupported(ldLanguage)) {
        language = ldLanguage;
        confidence = langDetectResult[0][1];
      }
      // Fall back to franc result
      else if (this._isSupported(francLanguage)) {
        language = francLanguage;
        confidence = 0.6;
      }
      // Default to English if detection fails
      else {
        language = config.languages.default || 'english';
        confidence = 0.3;
      }
      
      // Check if it's a RTL language
      const isRightToLeft = this.rtlLanguages.includes(language);
      
      return {
        language,
        confidence,
        isRightToLeft,
        detectionMethods: {
          franc: francLanguage,
          languageDetect: ldLanguage
        }
      };
    } catch (error) {
      logger.error('Language detection failed:', error);
      return {
        language: config.languages.default || 'english',
        confidence: 0,
        isRightToLeft: false,
        error: error.message
      };
    }
  }
  
  /**
   * Process text based on detected language
   * @param {string} text - The text to process
   * @param {Object} options - Processing options
   * @returns {Object} Processed text and metadata
   */
  processText(text, options = {}) {
    try {
      if (!text) return { text: '', language: config.languages.default };
      
      // Detect language if not provided
      const languageInfo = options.language 
        ? { language: options.language, isRightToLeft: this.rtlLanguages.includes(options.language) }
        : this.detectLanguage(text);
      
      let processedText = text;
      const metadata = { ...languageInfo };
      
      // Apply language-specific processing
      switch (languageInfo.language) {
        case 'arabic':
          processedText = this._processArabicText(text, options);
          metadata.wordCount = this._countArabicWords(processedText);
          break;
          
        case 'english':
          processedText = this._processEnglishText(text, options);
          metadata.wordCount = processedText.split(/\s+/).filter(Boolean).length;
          break;
          
        default:
          // Basic processing for other languages
          if (options.normalize) {
            processedText = processedText.normalize();
          }
          metadata.wordCount = processedText.split(/\s+/).filter(Boolean).length;
      }
      
      return {
        text: processedText,
        original: text,
        metadata
      };
    } catch (error) {
      logger.error('Text processing failed:', error);
      return {
        text,
        original: text,
        metadata: {
          language: config.languages.default,
          error: error.message
        }
      };
    }
  }
  
  /**
   * Format response based on language
   * @param {Object} response - The response object
   * @param {string} language - Target language
   * @returns {Object} Formatted response
   */
  formatResponse(response, language) {
    try {
      if (!response) return response;
      
      const targetLanguage = language || config.languages.default;
      const isRtl = this.rtlLanguages.includes(targetLanguage);
      
      // Add language metadata
      const formattedResponse = {
        ...response,
        language: targetLanguage,
        direction: isRtl ? 'rtl' : 'ltr'
      };
      
      // Apply language-specific formatting
      if (targetLanguage === 'arabic') {
        // Ensure proper punctuation for Arabic
        if (formattedResponse.content) {
          formattedResponse.content = this._formatArabicText(formattedResponse.content);
        }
      }
      
      return formattedResponse;
    } catch (error) {
      logger.error('Response formatting failed:', error);
      return {
        ...response,
        formattingError: error.message
      };
    }
  }
  
  /**
   * Get language-specific prompt templates
   * @param {string} templateName - Name of the template
   * @param {string} language - Target language
   * @returns {string} Language-specific prompt template
   */
  getPromptTemplate(templateName, language = 'english') {
    const templates = {
      english: {
        summary: "Summarize the following text concisely while preserving the key information:",
        analysis: "Analyze the following text and provide insights on its main themes and arguments:",
        question: "Based on the provided information, answer the following question:",
        translation: "Translate the following text to {targetLanguage}, maintaining the original meaning and tone:"
      },
      arabic: {
        summary: "لخص النص التالي بإيجاز مع الحفاظ على المعلومات الرئيسية:",
        analysis: "حلل النص التالي وقدم رؤى حول موضوعاته وحججه الرئيسية:",
        question: "بناءً على المعلومات المقدمة، أجب على السؤال التالي:",
        translation: "ترجم النص التالي إلى {targetLanguage} مع الحفاظ على المعنى والنبرة الأصليين:"
      }
    };
    
    // Get templates for the requested language or fall back to English
    const languageTemplates = templates[language] || templates.english;
    
    // Return the requested template or a default message
    return languageTemplates[templateName] || 
           templates.english[templateName] || 
           "Process the following text:";
  }
  
  // Private helper methods
  
  /**
   * Process Arabic text with specialized handling
   * @private
   */
  _processArabicText(text, options = {}) {
    let processed = text;
    
    // Normalize Arabic text (handle different forms of characters)
    if (options.normalize !== false) {
      processed = arabicNormalizer(processed);
    }
    
    // Remove Arabic stopwords if requested
    if (options.removeStopwords) {
      const words = processed.split(/\s+/);
      const filteredWords = words.filter(word => !arabicStopwords.includes(word));
      processed = filteredWords.join(' ');
    }
    
    // Apply stemming if requested (reduce words to their root form)
    if (options.stem) {
      const words = processed.split(/\s+/);
      const stemmedWords = words.map(word => arabicStemmer(word));
      processed = stemmedWords.join(' ');
    }
    
    // Fix common Arabic text issues
    processed = this._fixArabicTextIssues(processed);
    
    return processed;
  }
  
  /**
   * Process English text
   * @private
   */
  _processEnglishText(text, options = {}) {
    let processed = text;
    
    // Basic normalization
    if (options.normalize !== false) {
      processed = processed.normalize();
    }
    
    // Remove English stopwords if requested
    if (options.removeStopwords) {
      const stopwords = ['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being'];
      const words = processed.split(/\s+/);
      const filteredWords = words.filter(word => !stopwords.includes(word.toLowerCase()));
      processed = filteredWords.join(' ');
    }
    
    return processed;
  }
  
  /**
   * Format Arabic text for proper display
   * @private
   */
  _formatArabicText(text) {
    if (!text) return text;
    
    // Replace Western punctuation with Arabic equivalents
    let formatted = text
      .replace(/\?/g, '؟')
      .replace(/,/g, '،')
      .replace(/;/g, '؛');
    
    // Ensure proper spacing around punctuation
    formatted = formatted
      .replace(/\s*([،؛؟])\s*/g, '$1 ')
      .replace(/\s*([.])\s*/g, '$1 ');
    
    // Fix common formatting issues with Arabic text
    formatted = formatted
      .replace(/(\d+)\s*٪/g, '$1٪')  // Fix percentage spacing
      .replace(/\s+/g, ' ')          // Normalize spaces
      .trim();
    
    return formatted;
  }
  
  /**
   * Fix common issues with Arabic text
   * @private
   */
  _fixArabicTextIssues(text) {
    if (!text) return text;
    
    // Fix Hamza forms
    let fixed = text
      .replace(/إ/g, 'ا')  // In formal Arabic, often normalized
      .replace(/أ/g, 'ا')  // In formal Arabic, often normalized
      .replace(/آ/g, 'ا')  // In formal Arabic, often normalized
      
    // Fix Alef Lam
    fixed = fixed
      .replace(/([^\s])ال/g, '$1 ال')  // Add space before Al prefix if missing
      
    // Fix Tatweel (kashida) - remove elongation in formal text
    fixed = fixed.replace(/ـ/g, '');
    
    return fixed;
  }
  
  /**
   * Count words in Arabic text
   * @private
   */
  _countArabicWords(text) {
    if (!text) return 0;
    
    // Split on whitespace and filter out empty strings
    return text.split(/\s+/).filter(Boolean).length;
  }
  
  /**
   * Map franc ISO 639-3 code to language name
   * @private
   */
  _mapFrancCodeToLanguage(code) {
    const mapping = {
      'ara': 'arabic',
      'eng': 'english',
      'fra': 'french',
      'spa': 'spanish',
      'deu': 'german',
      'cmn': 'chinese',
      'zho': 'chinese',
      'und': 'unknown'
    };
    
    return mapping[code] || 'unknown';
  }
  
  /**
   * Check if a language is supported
   * @private
   */
  _isSupported(language) {
    return this.supportedLanguages.includes(language);
  }
}

module.exports = new LanguageService();
