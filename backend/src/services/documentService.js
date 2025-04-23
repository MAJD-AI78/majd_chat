const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const xlsx = require('xlsx');
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
const { DocumentOrchestrator } = require('../orchestration/documentOrchestrator');
const { DocumentGenerationOrchestrator } = require('../orchestration/documentGenerationOrchestrator');
const { detectLanguage } = require('./languageDetectionService');
const { logger } = require('../utils/logger');
const config = require('../config');

// Initialize orchestrators
const documentOrchestrator = new DocumentOrchestrator();
const documentGenerationOrchestrator = new DocumentGenerationOrchestrator();

// Process uploaded document
const processUploadedDocument = async (file, userId) => {
  try {
    const documentId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create user document directory if it doesn't exist
    const userDocDir = path.join(config.documentProcessing.storagePath, userId);
    if (!fs.existsSync(userDocDir)) {
      fs.mkdirSync(userDocDir, { recursive: true });
    }
    
    // Move file from temp to permanent storage
    const storagePath = path.join(userDocDir, documentId + path.extname(file.originalname));
    fs.copyFileSync(file.path, storagePath);
    
    // Clean up temp file
    fs.unlinkSync(file.path);
    
    // Detect format
    const format = detectDocumentFormat(file.originalname);
    
    // Create metadata
    const metadata = {
      documentId,
      userId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storagePath,
      uploadTime: timestamp,
      format,
      status: 'uploaded',
      processingStage: 'ingestion',
    };
    
    // Store metadata
    await storeMetadata(documentId, metadata);
    
    // Return result
    return {
      documentId,
      status: 'uploaded',
      metadata: {
        originalName: file.originalname,
        size: file.size,
        format,
        uploadTime: timestamp
      }
    };
  } catch (error) {
    logger.error('Document upload processing failed:', error);
    throw new Error(`Document processing failed: ${error.message}`);
  }
};

// Process document content
const processDocumentContent = async (documentId, options = {}) => {
  try {
    // Get document metadata
    const metadata = await getMetadata(documentId);
    if (!metadata) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    // Update processing stage
    await updateMetadata(documentId, {
      processingStage: 'processing',
      processingStartTime: new Date().toISOString()
    });
    
    // Extract content from document
    const content = await extractContent(metadata);
    
    // Detect language
    const languageInfo = detectLanguage(content.text);
    
    // Update metadata with language info
    await updateMetadata(documentId, {
      language: languageInfo.language,
      languageConfidence: languageInfo.confidence,
      isRightToLeft: languageInfo.isRightToLeft
    });
    
    // Process document through orchestrator
    const result = await documentOrchestrator.processDocument(
      documentId,
      content,
      options
    );
    
    // Update metadata with processing results
    await updateMetadata(documentId, {
      processingStage: 'completed',
      processingEndTime: new Date().toISOString(),
      processingResults: {
        summary: result.summary,
        entities: result.entities,
        topics: result.topics,
        sentiment: result.sentiment
      }
    });
    
    return {
      documentId,
      status: 'processed',
      summary: result.summary,
      language: languageInfo.language,
      platform: result.platform,
      processingTime: result.processingTime
    };
  } catch (error) {
    logger.error(`Document processing failed for ${documentId}:`, error);
    
    // Update metadata with error
    await updateMetadata(documentId, {
      processingStage: 'failed',
      processingEndTime: new Date().toISOString(),
      processingError: error.message
    });
    
    throw new Error(`Document processing failed: ${error.message}`);
  }
};

// Get document analysis
const getDocumentAnalysis = async (documentId) => {
  try {
    // Get document metadata
    const metadata = await getMetadata(documentId);
    if (!metadata) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    // Check if document has been processed
    if (metadata.processingStage !== 'completed') {
      throw new Error(`Document has not been fully processed: ${metadata.processingStage}`);
    }
    
    // Get content
    const content = await getDocumentContent(documentId);
    
    // Return analysis
    return {
      documentId,
      metadata: {
        originalName: metadata.originalName,
        size: metadata.size,
        format: metadata.format,
        uploadTime: metadata.uploadTime,
        language: metadata.language,
        processingTime: new Date(metadata.processingEndTime) - new Date(metadata.processingStartTime)
      },
      summary: metadata.processingResults.summary,
      entities: metadata.processingResults.entities,
      topics: metadata.processingResults.topics,
      sentiment: metadata.processingResults.sentiment,
      contentPreview: content.text.substring(0, 500) + (content.text.length > 500 ? '...' : '')
    };
  } catch (error) {
    logger.error(`Failed to get document analysis for ${documentId}:`, error);
    throw new Error(`Analysis retrieval failed: ${error.message}`);
  }
};

// Ask question about document
const askDocumentQuestion = async (documentId, question, options = {}) => {
  try {
    // Get document metadata
    const metadata = await getMetadata(documentId);
    if (!metadata) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    // Get content
    const content = await getDocumentContent(documentId);
    
    // Ask question through orchestrator
    const result = await documentOrchestrator.askDocumentQuestion(
      documentId,
      content,
      question,
      options
    );
    
    return {
      documentId,
      question,
      answer: result.answer,
      platform: result.platform,
      thinkingSteps: options.includeThinking ? result.thinkingSteps : undefined
    };
  } catch (error) {
    logger.error(`Document question failed for ${documentId}:`, error);
    throw new Error(`Question failed: ${error.message}`);
  }
};

// Generate document
const generateDocument = async (options, userId) => {
  try {
    // Validate options
    if (!options.documentType) {
      throw new Error('Document type is required');
    }
    
    if (!options.title) {
      throw new Error('Document title is required');
    }
    
    if (!options.language) {
      options.language = config.languages.default;
    }
    
    if (!options.format) {
      options.format = 'pdf';
    }
    
    // Check if format is supported
    if (!config.documentProcessing.generation.supportedFormats.includes(options.format)) {
      throw new Error(`Unsupported format: ${options.format}. Supported formats: ${config.documentProcessing.generation.supportedFormats.join(', ')}`);
    }
    
    // Generate document through orchestrator
    const result = await documentGenerationOrchestrator.generateDocument(options, userId);
    
    return result;
  } catch (error) {
    logger.error('Document generation failed:', error);
    throw new Error(`Generation failed: ${error.message}`);
  }
};

// Get generation status
const getGenerationStatus = async (generationId) => {
  try {
    // Get generation metadata
    const metadata = await getGenerationMetadata(generationId);
    if (!metadata) {
      throw new Error(`Generation not found: ${generationId}`);
    }
    
    return {
      generationId,
      status: metadata.status,
      progress: metadata.progress,
      startTime: metadata.startTime,
      endTime: metadata.endTime,
      error: metadata.error
    };
  } catch (error) {
    logger.error(`Failed to get generation status for ${generationId}:`, error);
    throw new Error(`Status check failed: ${error.message}`);
  }
};

// Get generated document file
const getGeneratedDocumentFile = async (generationId, format) => {
  try {
    // Get generation metadata
    const metadata = await getGenerationMetadata(generationId);
    if (!metadata) {
      throw new Error(`Generation not found: ${generationId}`);
    }
    
    // Check if generation is completed
    if (metadata.status !== 'completed') {
      throw new Error(`Generation is not completed: ${metadata.status}`);
    }
    
    // Check if requested format is available
    if (!metadata.availableFormats.includes(format)) {
      throw new Error(`Format not available: ${format}. Available formats: ${metadata.availableFormats.join(', ')}`);
    }
    
    // Get file path
    const filePath = path.join(
      config.documentProcessing.storagePath,
      metadata.userId,
      'generated',
      `${generationId}.${format}`
    );
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Determine MIME type
    const mimeType = getMimeType(format);
    
    return {
      filePath,
      mimeType,
      filename: `${metadata.title}.${format}`
    };
  } catch (error) {
    logger.error(`Document download failed for ${generationId}:`, error);
    throw new Error(`Download failed: ${error.message}`);
  }
};

// Helper functions

// Detect document format from filename
const detectDocumentFormat = (filename) => {
  const ext = path.extname(filename).toLowerCase().substring(1);
  
  // Check in each category
  if (config.documentProcessing.supportedFormats.text.includes(ext)) {
    return 'text';
  } else if (config.documentProcessing.supportedFormats.spreadsheet.includes(ext)) {
    return 'spreadsheet';
  } else if (config.documentProcessing.supportedFormats.presentation.includes(ext)) {
    return 'presentation';
  } else if (config.documentProcessing.supportedFormats.image.includes(ext)) {
    return 'image';
  } else if (config.documentProcessing.supportedFormats.code.includes(ext)) {
    return 'code';
  }
  
  return 'unknown';
};

// Extract content from document
const extractContent = async (metadata) => {
  const filePath = metadata.storagePath;
  const format = metadata.format;
  const fileBuffer = fs.readFileSync(filePath);
  
  let content = {
    text: '',
    metadata: {},
    structure: {}
  };
  
  switch (format) {
    case 'text':
      const ext = path.extname(metadata.originalName).toLowerCase();
      if (ext === '.pdf') {
        content = await extractFromPdf(fileBuffer);
      } else if (ext === '.docx') {
        content = await extractFromDocx(fileBuffer);
      } else {
        // Plain text or other text formats
        content.text = fileBuffer.toString('utf-8');
        content.structure = { type: 'text' };
      }
      break;
      
    case 'spreadsheet':
      content = await extractFromSpreadsheet(fileBuffer);
      break;
      
    case 'presentation':
      content = await extractFromPresentation(fileBuffer);
      break;
      
    case 'image':
      if (config.documentProcessing.ocr.enabled) {
        content = await extractFromImage(fileBuffer, metadata.originalName);
      } else {
        content.text = '[Image content - OCR disabled]';
        content.structure = { type: 'image' };
      }
      break;
      
    case 'code':
      content.text = fileBuffer.toString('utf-8');
      content.structure = { 
        type: 'code',
        language: path.extname(metadata.originalName).toLowerCase().substring(1)
      };
      break;
      
    default:
      content.text = fileBuffer.toString('utf-8');
      content.structure = { type: 'unknown' };
  }
  
  return content;
};

// Extract text from PDF
const extractFromPdf = async (buffer) => {
  try {
    const result = await pdf(buffer);
    
    return {
      text: result.text,
      metadata: {
        title: result.info.Title,
        author: result.info.Author,
        subject: result.info.Subject,
        keywords: result.info.Keywords,
        creator: result.info.Creator,
        producer: result.info.Producer,
        creationDate: result.info.CreationDate,
        modDate: result.info.ModDate
      },
      structure: {
        type: 'pdf',
        pageCount: result.numpages
      }
    };
  } catch (error) {
    logger.error('PDF extraction failed:', error);
    return {
      text: '[PDF extraction failed]',
      metadata: {},
      structure: { type: 'pdf', error: error.message }
    };
  }
};

// Extract text from DOCX
const extractFromDocx = async (buffer) => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    
    return {
      text: result.value,
      metadata: {},
      structure: { type: 'docx' }
    };
  } catch (error) {
    logger.error('DOCX extraction failed:', error);
    return {
      text: '[DOCX extraction failed]',
      metadata: {},
      structure: { type: 'docx', error: error.message }
    };
  }
};

// Extract from spreadsheet
const extractFromSpreadsheet = async (buffer) => {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    let text = '';
    
    // Process each sheet
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      text += `Sheet: ${sheetName}\n`;
      text += xlsx.utils.sheet_to_csv(sheet);
      text += '\n\n';
    });
    
    return {
      text,
      metadata: {
        sheetCount: workbook.SheetNames.length,
        sheetNames: workbook.SheetNames
      },
      structure: { 
        type: 'spreadsheet',
        sheets: workbook.SheetNames
      }
    };
  } catch (error) {
    logger.error('Spreadsheet extraction failed:', error);
    return {
      text: '[Spreadsheet extraction failed]',
      metadata: {},
      structure: { type: 'spreadsheet', error: error.message }
    };
  }
};

// Extract from presentation
const extractFromPresentation = async (buffer) => {
  // Note: This is a simplified implementation
  // For a complete implementation, you would need a library that can parse PPT/PPTX
  return {
    text: '[Presentation content - extraction not fully implemented]',
    metadata: {},
    structure: { type: 'presentation' }
  };
};

// Extract text from image using OCR
const extractFromImage = async (buffer, filename) => {
  try {
    // Optimize image for OCR
    const optimizedBuffer = await sharp(buffer)
      .greyscale()
      .normalize()
      .toBuffer();
    
    // Create OCR worker
    const worker = await createWorker({
      logger: m => logger.debug(m),
      langPath: path.join(config.paths.data, 'tessdata')
    });
    
    // Load language data
    await worker.loadLanguage(config.documentProcessing.ocr.languages.join('+'));
    await worker.initialize(config.documentProcessing.ocr.languages.join('+'));
    
    // Recognize text
    const { data } = await worker.recognize(optimizedBuffer);
    
    // Terminate worker
    await worker.terminate();
    
    return {
      text: data.text,
      metadata: {
        confidence: data.confidence
      },
      structure: { 
        type: 'image',
        words: data.words,
        hocr: data.hocr
      }
    };
  } catch (error) {
    logger.error('Image OCR failed:', error);
    return {
      text: '[Image OCR failed]',
      metadata: {},
      structure: { type: 'image', error: error.message }
    };
  }
};

// Store document metadata
const storeMetadata = async (documentId, metadata) => {
  try {
    const metadataDir = path.join(config.paths.data, 'metadata');
    if (!fs.existsSync(metadataDir)) {
      fs.mkdirSync(metadataDir, { recursive: true });
    }
    
    const metadataPath = path.join(metadataDir, `${documentId}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    return true;
  } catch (error) {
    logger.error(`Failed to store metadata for ${documentId}:`, error);
    throw new Error(`Metadata storage failed: ${error.message}`);
  }
};

// Get document metadata
const getMetadata = async (documentId) => {
  try {
    const metadataPath = path.join(config.paths.data, 'metadata', `${documentId}.json`);
    
    if (!fs.existsSync(metadataPath)) {
      return null;
    }
    
    const metadataStr = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(metadataStr);
  } catch (error) {
    logger.error(`Failed to get metadata for ${documentId}:`, error);
    throw new Error(`Metadata retrieval failed: ${error.message}`);
  }
};

// Update document metadata
const updateMetadata = async (documentId, updates) => {
  try {
    const metadata = await getMetadata(documentId);
    if (!metadata) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    const updatedMetadata = { ...metadata, ...updates };
    await storeMetadata(documentId, updatedMetadata);
    
    return true;
  } catch (error) {
    logger.error(`Failed to update metadata for ${documentId}:`, error);
    throw new Error(`Metadata update failed: ${error.message}`);
  }
};

// Get document content
const getDocumentContent = async (documentId) => {
  try {
    const metadata = await getMetadata(documentId);
    if (!metadata) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    return await extractContent(metadata);
  } catch (error) {
    logger.error(`Failed to get content for ${documentId}:`, error);
    throw new Error(`Content retrieval failed: ${error.message}`);
  }
};

// Get generation metadata
const getGenerationMetadata = async (generationId) => {
  try {
    const metadataPath = path.join(config.paths.data, 'generations', `${generationId}.json`);
    
    if (!fs.existsSync(metadataPath)) {
      return null;
    }
    
    const metadataStr = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(metadataStr);
  } catch (error) {
    logger.error(`Failed to get generation metadata for ${generationId}:`, error);
    throw new Error(`Generation metadata retrieval failed: ${error.message}`);
  }
};

// Get MIME type for format
const getMimeType = (format) => {
  const mimeTypes = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'md': 'text/markdown',
    'html': 'text/html',
    'txt': 'text/plain'
  };
  
  return mimeTypes[format] || 'application/octet-stream';
};

module.exports = {
  processUploadedDocument,
  processDocumentContent,
  getDocumentAnalysis,
  askDocumentQuestion,
  generateDocument,
  getGenerationStatus,
  getGeneratedDocumentFile
};
