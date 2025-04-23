const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { OrchestrationLayer } = require('../orchestration');

// Initialize the orchestration layer
const orchestrationLayer = new OrchestrationLayer();

// API routes
router.get('/', (req, res) => {
  res.status(200).json({
    name: 'Majd Platform API',
    version: process.env.npm_package_version || '1.0.0',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// Get available platforms
router.get('/platforms', (req, res) => {
  try {
    // This would typically come from a database or configuration
    const platforms = [
      {
        id: 'chatgpt',
        name: 'ChatGPT',
        description: 'OpenAI\'s ChatGPT for general conversation and creative tasks',
        status: 'active'
      },
      {
        id: 'perplexity',
        name: 'Perplexity',
        description: 'Perplexity AI for research and information synthesis',
        status: 'active'
      },
      {
        id: 'gemini',
        name: 'Gemini',
        description: 'Google\'s Gemini for multimodal reasoning tasks',
        status: 'active'
      },
      {
        id: 'copilot',
        name: 'GitHub Copilot',
        description: 'GitHub Copilot for code generation and software development',
        status: 'active'
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        description: 'DeepSeek for mathematical reasoning',
        status: 'active'
      },
      {
        id: 'grok3',
        name: 'Grok3',
        description: 'Grok3 for real-time data analysis',
        status: 'active'
      },
      {
        id: 'vertix',
        name: 'Vertix',
        description: 'Vertix for specialized domain expertise',
        status: 'active'
      },
      {
        id: 'local',
        name: 'Local Model',
        description: 'Locally deployed models for fallback and cost optimization',
        status: 'active'
      }
    ];
    
    res.status(200).json(platforms);
  } catch (error) {
    logger.error('Error retrieving platforms', error);
    res.status(500).json({ 
      error: 'An error occurred while retrieving platforms',
      message: error.message
    });
  }
});

// Get task types
router.get('/task-types', (req, res) => {
  try {
    // This would typically come from a database or configuration
    const taskTypes = [
      {
        id: 'general',
        name: 'General Conversation',
        description: 'General conversational tasks',
        defaultPlatform: 'chatgpt'
      },
      {
        id: 'research',
        name: 'Research',
        description: 'Information gathering and synthesis',
        defaultPlatform: 'perplexity'
      },
      {
        id: 'code',
        name: 'Code Generation',
        description: 'Software development and programming',
        defaultPlatform: 'copilot'
      },
      {
        id: 'reasoning',
        name: 'Reasoning',
        description: 'Logical and mathematical reasoning',
        defaultPlatform: 'deepseek'
      },
      {
        id: 'creative',
        name: 'Creative',
        description: 'Creative writing and content generation',
        defaultPlatform: 'chatgpt'
      },
      {
        id: 'multimodal',
        name: 'Multimodal',
        description: 'Tasks involving multiple modalities (text, images, etc.)',
        defaultPlatform: 'gemini'
      },
      {
        id: 'data_analysis',
        name: 'Data Analysis',
        description: 'Analysis of data and statistics',
        defaultPlatform: 'grok3'
      },
      {
        id: 'domain_expertise',
        name: 'Domain Expertise',
        description: 'Specialized knowledge in specific domains',
        defaultPlatform: 'vertix'
      }
    ];
    
    res.status(200).json(taskTypes);
  } catch (error) {
    logger.error('Error retrieving task types', error);
    res.status(500).json({ 
      error: 'An error occurred while retrieving task types',
      message: error.message
    });
  }
});

// Get user context
router.get('/context/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get context from the orchestration layer
    const context = await orchestrationLayer.contextManager.getContext(userId);
    
    res.status(200).json(context);
  } catch (error) {
    logger.error('Error retrieving context', error);
    res.status(500).json({ 
      error: 'An error occurred while retrieving context',
      message: error.message
    });
  }
});

// Clear user context
router.delete('/context/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Clear context from the orchestration layer
    await orchestrationLayer.contextManager.clearContext(userId);
    
    res.status(200).json({ message: 'Context cleared successfully' });
  } catch (error) {
    logger.error('Error clearing context', error);
    res.status(500).json({ 
      error: 'An error occurred while clearing context',
      message: error.message
    });
  }
});

module.exports = router;
