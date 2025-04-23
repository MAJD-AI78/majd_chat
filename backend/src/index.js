const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { logger } = require('./utils/logger');
const { OrchestrationLayer } = require('./orchestration');
const config = require('./config');

// Initialize the application
const app = express();
const port = config.port || 3000;

// Initialize the orchestration layer
const orchestrationLayer = new OrchestrationLayer();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS support
app.use(express.json({ limit: '10mb' })); // JSON body parsing with increased limit
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // Logging

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api', require('./routes/api'));

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId, options } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const userIdentifier = userId || req.ip;
    
    // Process the request through the orchestration layer
    const response = await orchestrationLayer.processRequest(
      message,
      userIdentifier,
      options || {}
    );
    
    return res.status(200).json(response);
  } catch (error) {
    logger.error('Error processing chat request', error);
    return res.status(500).json({ 
      error: 'An error occurred while processing your request',
      message: error.message
    });
  }
});

// Multi-platform chat endpoint
app.post('/api/chat/multi', async (req, res) => {
  try {
    const { message, userId, platforms, options } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ error: 'At least one platform must be specified' });
    }
    
    const userIdentifier = userId || req.ip;
    
    // Process the multi-platform request
    const response = await orchestrationLayer.processMultiPlatformRequest(
      message,
      userIdentifier,
      platforms,
      options || {}
    );
    
    return res.status(200).json(response);
  } catch (error) {
    logger.error('Error processing multi-platform chat request', error);
    return res.status(500).json({ 
      error: 'An error occurred while processing your multi-platform request',
      message: error.message
    });
  }
});

// Streaming chat endpoint
app.post('/api/chat/stream', (req, res) => {
  try {
    const { message, userId, options } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const userIdentifier = userId || req.ip;
    
    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send initial message
    res.write(`data: ${JSON.stringify({ type: 'start', timestamp: new Date().toISOString() })}\n\n`);
    
    // Process the request with streaming
    const onChunk = (chunk, metadata) => {
      res.write(`data: ${JSON.stringify({ 
        type: 'chunk', 
        content: chunk,
        metadata,
        timestamp: new Date().toISOString()
      })}\n\n`);
    };
    
    orchestrationLayer.processRequest(
      message,
      userIdentifier,
      { ...options, stream: true, onChunk }
    )
    .then(response => {
      // Send completion message
      res.write(`data: ${JSON.stringify({ 
        type: 'end',
        response,
        timestamp: new Date().toISOString()
      })}\n\n`);
      res.end();
    })
    .catch(error => {
      logger.error('Error processing streaming chat request', error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error',
        error: 'An error occurred while processing your request',
        message: error.message,
        timestamp: new Date().toISOString()
      })}\n\n`);
      res.end();
    });
  } catch (error) {
    logger.error('Error setting up streaming chat request', error);
    return res.status(500).json({ 
      error: 'An error occurred while setting up your streaming request',
      message: error.message
    });
  }
});

// Document processing endpoints
if (config.features.enableDocumentProcessing) {
  app.use('/api/documents', require('./routes/documentRoutes'));
  logger.info('Document processing endpoints enabled');
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ 
    error: 'An unexpected error occurred',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Start the server
app.listen(port, async () => {
  try {
    // Create storage directories if they don't exist
    const fs = require('fs');
    const path = require('path');
    
    // Ensure logs directory exists
    if (!fs.existsSync(config.paths.logs)) {
      fs.mkdirSync(config.paths.logs, { recursive: true });
      logger.info(`Created logs directory at ${config.paths.logs}`);
    }
    
    // Ensure data directory exists
    if (!fs.existsSync(config.paths.data)) {
      fs.mkdirSync(config.paths.data, { recursive: true });
      logger.info(`Created data directory at ${config.paths.data}`);
    }
    
    // Ensure document storage directories exist if document processing is enabled
    if (config.features.enableDocumentProcessing) {
      if (!fs.existsSync(config.paths.documents)) {
        fs.mkdirSync(config.paths.documents, { recursive: true });
        logger.info(`Created documents directory at ${config.paths.documents}`);
      }
      
      if (!fs.existsSync(config.paths.temp)) {
        fs.mkdirSync(config.paths.temp, { recursive: true });
        logger.info(`Created temp directory at ${config.paths.temp}`);
      }
    }
    
    // Initialize the orchestration layer
    await orchestrationLayer.initialize();
    logger.info(`Majd platform server running on port ${port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Document processing: ${config.features.enableDocumentProcessing ? 'Enabled' : 'Disabled'}`);
    logger.info(`Multilingual support: ${config.features.enableMultilingual ? 'Enabled' : 'Disabled'}`);
  } catch (error) {
    logger.error('Failed to initialize the server', error);
    process.exit(1);
  }
});

module.exports = app;
