const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

// Define configuration with defaults
const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Security
  jwtSecret: process.env.JWT_SECRET,
  apiKeySalt: process.env.API_KEY_SALT,
  
  // OpenAI (ChatGPT)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
  
  // Perplexity
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
  PERPLEXITY_MODEL: process.env.PERPLEXITY_MODEL || 'sonar-medium-online',
  
  // Google (Gemini)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
  
  // GitHub Copilot
  GITHUB_COPILOT_API_KEY: process.env.GITHUB_COPILOT_API_KEY,
  GITHUB_COPILOT_MODEL: process.env.GITHUB_COPILOT_MODEL || 'copilot-4',
  
  // DeepSeek
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-r1-plus',
  DEEPSEEK_LOCAL_ENDPOINT: process.env.DEEPSEEK_LOCAL_ENDPOINT || 'http://localhost:8000/v1/chat/completions',
  USE_DEEPSEEK_LOCAL_MODEL: process.env.USE_DEEPSEEK_LOCAL_MODEL === 'true',
  
  // Grok3
  GROK3_API_KEY: process.env.GROK3_API_KEY,
  GROK3_MODEL: process.env.GROK3_MODEL || 'grok-3',
  
  // Vertix
  VERTIX_API_KEY: process.env.VERTIX_API_KEY,
  VERTIX_MODEL: process.env.VERTIX_MODEL || 'vertix-expert',
  
  // Local Model
  LOCAL_MODEL_ENDPOINT: process.env.LOCAL_MODEL_ENDPOINT || 'http://localhost:8000/v1/chat/completions',
  LOCAL_MODEL: process.env.LOCAL_MODEL || 'deepseek-r1-distill-qwen-7b',
  
  // Database Configuration
  database: {
    type: process.env.DB_TYPE || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'majd_db',
    user: process.env.DB_USER || 'majd_user',
    password: process.env.DB_PASSWORD,
  },
  
  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  
  // Vector Database Configuration
  vectorDb: {
    type: process.env.VECTOR_DB_TYPE || 'pinecone',
    apiKey: process.env.VECTOR_DB_API_KEY,
    environment: process.env.VECTOR_DB_ENVIRONMENT || 'us-west1-gcp',
    index: process.env.VECTOR_DB_INDEX || 'majd-index',
  },
  
  // Feature Flags
  features: {
    enableStreaming: process.env.ENABLE_STREAMING === 'true',
    enableLocalModels: process.env.ENABLE_LOCAL_MODELS === 'true',
    enableThinkingEngine: process.env.ENABLE_THINKING_ENGINE === 'true',
    enableMultiPlatformRequests: process.env.ENABLE_MULTI_PLATFORM_REQUESTS === 'true',
    enableFallbackChain: process.env.ENABLE_FALLBACK_CHAIN === 'true',
  },
  
  // Paths
  paths: {
    root: path.resolve(__dirname, '..'),
    src: path.resolve(__dirname),
    logs: path.resolve(__dirname, '..', 'logs'),
    data: path.resolve(__dirname, '..', 'data'),
    models: path.resolve(__dirname, '..', 'models'),
  }
};

// Validate critical configuration
function validateConfig() {
  const missingKeys = [];
  
  // Check for required API keys based on enabled features
  if (!config.OPENAI_API_KEY) missingKeys.push('OPENAI_API_KEY');
  if (!config.PERPLEXITY_API_KEY) missingKeys.push('PERPLEXITY_API_KEY');
  if (!config.GEMINI_API_KEY) missingKeys.push('GEMINI_API_KEY');
  if (!config.GITHUB_COPILOT_API_KEY) missingKeys.push('GITHUB_COPILOT_API_KEY');
  if (!config.DEEPSEEK_API_KEY && !config.USE_DEEPSEEK_LOCAL_MODEL) missingKeys.push('DEEPSEEK_API_KEY');
  if (!config.GROK3_API_KEY) missingKeys.push('GROK3_API_KEY');
  if (!config.VERTIX_API_KEY) missingKeys.push('VERTIX_API_KEY');
  
  // Check for security keys
  if (!config.jwtSecret) missingKeys.push('JWT_SECRET');
  if (!config.apiKeySalt) missingKeys.push('API_KEY_SALT');
  
  // Check database configuration if not in development mode
  if (config.nodeEnv !== 'development') {
    if (!config.database.password) missingKeys.push('DB_PASSWORD');
  }
  
  // Check vector database configuration
  if (!config.vectorDb.apiKey) missingKeys.push('VECTOR_DB_API_KEY');
  
  // Log warnings for missing configuration
  if (missingKeys.length > 0) {
    console.warn(`Warning: Missing configuration keys: ${missingKeys.join(', ')}`);
    console.warn('Some features may not work correctly without these keys.');
  }
}

// Only validate in non-test environments
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}

module.exports = config;
