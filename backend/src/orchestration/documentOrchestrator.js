const { TaskRouter } = require('./taskRouter');
const { ContextManager } = require('./contextManager');
const { ThinkingEngine } = require('./thinkingEngine');
const { ResponseSynthesizer } = require('./responseSynthesizer');
const { logger } = require('../utils/logger');
const config = require('../config');

class DocumentOrchestrator {
  constructor() {
    this.taskRouter = new TaskRouter();
    this.contextManager = new ContextManager();
    this.thinkingEngine = new ThinkingEngine();
    this.responseSynthesizer = new ResponseSynthesizer();
  }
  
  async processDocument(documentId, documentContent, options = {}) {
    try {
      logger.info(`Processing document ${documentId}`);
      const startTime = Date.now();
      
      // Create document context
      const documentContext = await this.contextManager.createDocumentContext(
        documentId, 
        documentContent
      );
      
      // Determine processing tasks based on options
      const tasks = this.determineTasks(options);
      
      // Route tasks to appropriate AI platforms
      const taskResults = await Promise.all(
        tasks.map(async (task) => {
          // Select platform for this task
          const platform = await this.taskRouter.selectPlatformForTask(
            task.type,
            documentContent,
            task.options
          );
          
          logger.info(`Selected ${platform.name} for ${task.type} task on document ${documentId}`);
          
          // Generate thinking steps
          const thinkingSteps = await this.thinkingEngine.generateThinkingSteps(
            task.type,
            documentContent,
            task.options
          );
          
          // Execute task on selected platform
          const result = await platform.executeTask(
            task.type,
            documentContent,
            documentContext,
            thinkingSteps,
            task.options
          );
          
          return {
            task: task.type,
            platform: platform.name,
            result,
            thinkingSteps
          };
        })
      );
      
      // Synthesize final response
      const processedResult = await this.responseSynthesizer.synthesizeDocumentResults(
        taskResults,
        documentContext
      );
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      logger.info(`Document ${documentId} processed in ${processingTime}ms`);
      
      return {
        ...processedResult,
        processingTime,
        platform: taskResults.map(tr => tr.platform).join(', ')
      };
    } catch (error) {
      logger.error(`Document orchestration failed for ${documentId}:`, error);
      throw new Error(`Document processing failed: ${error.message}`);
    }
  }
  
  determineTasks(options) {
    const tasks = [];
    
    // Basic tasks
    tasks.push({ type: 'extract', options: {} });
    tasks.push({ type: 'analyze', options: {} });
    
    // Optional tasks based on user options
    if (options.summarize) {
      tasks.push({ type: 'summarize', options: options.summarizeOptions || {} });
    }
    
    if (options.extractEntities) {
      tasks.push({ type: 'extractEntities', options: options.entityOptions || {} });
    }
    
    if (options.analyze) {
      tasks.push({ type: 'deepAnalysis', options: options.analysisOptions || {} });
    }
    
    return tasks;
  }
  
  async askDocumentQuestion(documentId, documentContent, question, options = {}) {
    try {
      logger.info(`Processing question for document ${documentId}: "${question}"`);
      
      // Get or create document context
      const documentContext = await this.contextManager.getOrCreateDocumentContext(
        documentId, 
        documentContent
      );
      
      // Add question to context
      documentContext.currentQuestion = question;
      
      // Select platform for question answering
      const platform = await this.taskRouter.selectPlatformForTask(
        'documentQA',
        documentContent,
        { question, ...options }
      );
      
      logger.info(`Selected ${platform.name} for document QA on document ${documentId}`);
      
      // Generate thinking steps
      const thinkingSteps = await this.thinkingEngine.generateThinkingSteps(
        'documentQA',
        documentContent,
        { question, ...options }
      );
      
      // Execute question answering on selected platform
      const result = await platform.executeTask(
        'documentQA',
        documentContent,
        documentContext,
        thinkingSteps,
        { question, ...options }
      );
      
      // Synthesize final response
      const answer = await this.responseSynthesizer.synthesizeDocumentQA(
        result,
        question,
        documentContext,
        thinkingSteps
      );
      
      return {
        question,
        answer,
        platform: platform.name,
        thinkingSteps: options.includeThinking ? thinkingSteps : undefined
      };
    } catch (error) {
      logger.error(`Document QA failed for ${documentId}:`, error);
      throw new Error(`Question answering failed: ${error.message}`);
    }
  }
}

module.exports = { DocumentOrchestrator };
