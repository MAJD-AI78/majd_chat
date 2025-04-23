const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { 
  processUploadedDocument, 
  processDocumentContent,
  getDocumentAnalysis,
  askDocumentQuestion,
  generateDocument,
  getGenerationStatus,
  getGeneratedDocumentFile
} = require('../services/documentService');
const { logger } = require('../utils/logger');
const config = require('../config');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, config.documentProcessing.tempPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: config.documentProcessing.maxFileSize 
  },
  fileFilter: function (req, file, cb) {
    // Check if the file type is supported
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    const allSupportedFormats = [
      ...config.documentProcessing.supportedFormats.text,
      ...config.documentProcessing.supportedFormats.spreadsheet,
      ...config.documentProcessing.supportedFormats.presentation,
      ...config.documentProcessing.supportedFormats.image,
      ...config.documentProcessing.supportedFormats.code
    ];
    
    if (allSupportedFormats.includes(ext)) {
      return cb(null, true);
    }
    
    return cb(new Error(`Unsupported file type: ${ext}. Supported types: ${allSupportedFormats.join(', ')}`));
  }
});

// Upload document
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document provided' });
    }
    
    const userId = req.user ? req.user.id : 'anonymous';
    const result = await processUploadedDocument(req.file, userId);
    
    res.json(result);
  } catch (error) {
    logger.error('Document upload failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process document
router.post('/:documentId/process', async (req, res) => {
  try {
    const result = await processDocumentContent(req.params.documentId, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Document processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get document analysis
router.get('/:documentId/analysis', async (req, res) => {
  try {
    const analysis = await getDocumentAnalysis(req.params.documentId);
    res.json(analysis);
  } catch (error) {
    logger.error('Failed to get document analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ask question about document
router.post('/:documentId/ask', async (req, res) => {
  try {
    const answer = await askDocumentQuestion(
      req.params.documentId, 
      req.body.question,
      req.body.options || {}
    );
    res.json(answer);
  } catch (error) {
    logger.error('Document question failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate document
router.post('/generate', async (req, res) => {
  try {
    const userId = req.user ? req.user.id : 'anonymous';
    const result = await generateDocument(req.body, userId);
    res.json(result);
  } catch (error) {
    logger.error('Document generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get generation status
router.get('/generation/:generationId/status', async (req, res) => {
  try {
    const status = await getGenerationStatus(req.params.generationId);
    res.json(status);
  } catch (error) {
    logger.error('Failed to get generation status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download generated document
router.get('/generation/:generationId/download', async (req, res) => {
  try {
    const { format } = req.query;
    const { filePath, mimeType, filename } = await getGeneratedDocumentFile(
      req.params.generationId,
      format
    );
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    logger.error('Document download failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
