/**
 * Thinking Engine Component for Majd Platform
 * 
 * This component is responsible for generating explicit reasoning steps,
 * implementing chain-of-thought processes, and providing transparent
 * thinking for complex problem solving.
 */

const { logger } = require('../utils/logger');
const config = require('../config');

class ThinkingEngine {
  constructor() {
    this.reasoningSteps = {
      PROBLEM_UNDERSTANDING: 'problem_understanding',
      INFORMATION_GATHERING: 'information_gathering',
      APPROACH_SELECTION: 'approach_selection',
      STEP_BY_STEP_REASONING: 'step_by_step_reasoning',
      VERIFICATION: 'verification',
      CONCLUSION: 'conclusion'
    };
    
    this.reasoningTemplates = {
      [this.reasoningSteps.PROBLEM_UNDERSTANDING]: 'Let me understand the problem: {problem}',
      [this.reasoningSteps.INFORMATION_GATHERING]: 'Relevant information I need to consider: {information}',
      [this.reasoningSteps.APPROACH_SELECTION]: 'I\'ll approach this by: {approach}',
      [this.reasoningSteps.STEP_BY_STEP_REASONING]: 'Step {step_number}: {step_content}',
      [this.reasoningSteps.VERIFICATION]: 'Let me verify my solution: {verification}',
      [this.reasoningSteps.CONCLUSION]: 'Therefore, the answer is: {conclusion}'
    };
    
    this.taskTypeReasoningMap = {
      'research': ['PROBLEM_UNDERSTANDING', 'INFORMATION_GATHERING', 'APPROACH_SELECTION', 'STEP_BY_STEP_REASONING', 'CONCLUSION'],
      'reasoning': ['PROBLEM_UNDERSTANDING', 'APPROACH_SELECTION', 'STEP_BY_STEP_REASONING', 'VERIFICATION', 'CONCLUSION'],
      'code': ['PROBLEM_UNDERSTANDING', 'APPROACH_SELECTION', 'STEP_BY_STEP_REASONING', 'VERIFICATION', 'CONCLUSION'],
      'creative': ['PROBLEM_UNDERSTANDING', 'APPROACH_SELECTION', 'STEP_BY_STEP_REASONING', 'CONCLUSION'],
      'data_analysis': ['PROBLEM_UNDERSTANDING', 'INFORMATION_GATHERING', 'APPROACH_SELECTION', 'STEP_BY_STEP_REASONING', 'VERIFICATION', 'CONCLUSION'],
      'domain_expertise': ['PROBLEM_UNDERSTANDING', 'INFORMATION_GATHERING', 'APPROACH_SELECTION', 'STEP_BY_STEP_REASONING', 'CONCLUSION'],
      'general': ['PROBLEM_UNDERSTANDING', 'APPROACH_SELECTION', 'STEP_BY_STEP_REASONING', 'CONCLUSION']
    };
  }

  /**
   * Generate thinking prompts for a specific task type
   * 
   * @param {string} taskType - The type of task
   * @param {string} userInput - The user's input
   * @param {Object} options - Additional options
   * @returns {Object} - Thinking prompts for the task
   */
  generateThinkingPrompts(taskType, userInput, options = {}) {
    // Get the reasoning steps for this task type
    const reasoningStepKeys = this.taskTypeReasoningMap[taskType] || this.taskTypeReasoningMap['general'];
    
    // Create the thinking prompts
    const thinkingPrompts = {
      systemPrompt: this.generateSystemPrompt(taskType, options),
      reasoningSteps: reasoningStepKeys.map(step => this.reasoningSteps[step]),
      templates: {}
    };
    
    // Add templates for each reasoning step
    reasoningStepKeys.forEach(step => {
      thinkingPrompts.templates[this.reasoningSteps[step]] = this.reasoningTemplates[step];
    });
    
    return thinkingPrompts;
  }

  /**
   * Generate a system prompt for the thinking process
   * 
   * @param {string} taskType - The type of task
   * @param {Object} options - Additional options
   * @returns {string} - The system prompt
   */
  generateSystemPrompt(taskType, options = {}) {
    const basePrompt = 'You are Majd, an advanced AI assistant that shows explicit reasoning and thinking processes. ';
    
    // Add task-specific instructions
    let taskSpecificPrompt = '';
    switch (taskType) {
      case 'research':
        taskSpecificPrompt = 'For this research task, show your information gathering process, evaluate sources, and synthesize findings. Cite sources when available.';
        break;
      case 'reasoning':
        taskSpecificPrompt = 'For this reasoning task, break down the problem, show each logical step, verify your work, and explain your conclusion.';
        break;
      case 'code':
        taskSpecificPrompt = 'For this coding task, analyze the requirements, plan your approach, implement the solution step by step, and test your code.';
        break;
      case 'creative':
        taskSpecificPrompt = 'For this creative task, explain your inspiration, outline your approach, and show how you developed the creative elements.';
        break;
      case 'data_analysis':
        taskSpecificPrompt = 'For this data analysis task, describe your methodology, show your analysis process, verify your findings, and present conclusions.';
        break;
      case 'domain_expertise':
        taskSpecificPrompt = 'For this domain-specific task, apply specialized knowledge, explain industry-specific concepts, and provide expert insights.';
        break;
      default:
        taskSpecificPrompt = 'Break down your thinking process into clear steps, showing how you arrive at your answer.';
    }
    
    // Add thinking style instructions
    const thinkingStylePrompt = 'Always make your reasoning explicit using a step-by-step approach. ' +
      'First understand the problem, then gather relevant information, select an approach, ' +
      'work through the solution methodically, verify your answer when appropriate, and provide a clear conclusion.';
    
    // Combine prompts
    return `${basePrompt}${taskSpecificPrompt} ${thinkingStylePrompt}`;
  }

  /**
   * Enhance a platform's prompt with thinking instructions
   * 
   * @param {Object} platformPrompt - The original platform prompt
   * @param {Object} thinkingPrompts - The thinking prompts
   * @param {string} platform - The target platform
   * @returns {Object} - The enhanced prompt
   */
  enhancePromptWithThinking(platformPrompt, thinkingPrompts, platform) {
    // Different platforms have different prompt structures
    switch (platform) {
      case 'chatgpt':
        return this.enhanceChatGPTPrompt(platformPrompt, thinkingPrompts);
      case 'perplexity':
        return this.enhancePerplexityPrompt(platformPrompt, thinkingPrompts);
      case 'gemini':
        return this.enhanceGeminiPrompt(platformPrompt, thinkingPrompts);
      case 'copilot':
        return this.enhanceCopilotPrompt(platformPrompt, thinkingPrompts);
      case 'deepseek':
        return this.enhanceDeepSeekPrompt(platformPrompt, thinkingPrompts);
      case 'grok3':
        return this.enhanceGrok3Prompt(platformPrompt, thinkingPrompts);
      case 'vertix':
        return this.enhanceVertixPrompt(platformPrompt, thinkingPrompts);
      case 'local':
        return this.enhanceLocalPrompt(platformPrompt, thinkingPrompts);
      default:
        return this.enhanceChatGPTPrompt(platformPrompt, thinkingPrompts);
    }
  }

  /**
   * Enhance ChatGPT prompt with thinking instructions
   * 
   * @param {Object} platformPrompt - The original ChatGPT prompt
   * @param {Object} thinkingPrompts - The thinking prompts
   * @returns {Object} - The enhanced prompt
   */
  enhanceChatGPTPrompt(platformPrompt, thinkingPrompts) {
    // Clone the platform prompt to avoid modifying the original
    const enhancedPrompt = JSON.parse(JSON.stringify(platformPrompt));
    
    // Find the system message
    const systemMessageIndex = enhancedPrompt.messages.findIndex(msg => msg.role === 'system');
    
    if (systemMessageIndex >= 0) {
      // Enhance existing system message
      enhancedPrompt.messages[systemMessageIndex].content = 
        `${thinkingPrompts.systemPrompt} ${enhancedPrompt.messages[systemMessageIndex].content}`;
    } else {
      // Add new system message
      enhancedPrompt.messages.unshift({
        role: 'system',
        content: thinkingPrompts.systemPrompt
      });
    }
    
    // Add thinking instructions to the last user message
    const lastUserMessageIndex = findLastIndex(enhancedPrompt.messages, msg => msg.role === 'user');
    
    if (lastUserMessageIndex >= 0) {
      const userMessage = enhancedPrompt.messages[lastUserMessageIndex];
      const thinkingInstructions = this.generateThinkingInstructions(thinkingPrompts);
      
      enhancedPrompt.messages[lastUserMessageIndex].content = 
        `${userMessage.content}\n\n${thinkingInstructions}`;
    }
    
    return enhancedPrompt;
  }

  /**
   * Enhance Perplexity prompt with thinking instructions
   * 
   * @param {Object} platformPrompt - The original Perplexity prompt
   * @param {Object} thinkingPrompts - The thinking prompts
   * @returns {Object} - The enhanced prompt
   */
  enhancePerplexityPrompt(platformPrompt, thinkingPrompts) {
    // Similar to ChatGPT but with Perplexity-specific adjustments
    const enhancedPrompt = JSON.parse(JSON.stringify(platformPrompt));
    
    // Find the system message
    const systemMessageIndex = enhancedPrompt.messages.findIndex(msg => msg.role === 'system');
    
    if (systemMessageIndex >= 0) {
      // Enhance existing system message
      enhancedPrompt.messages[systemMessageIndex].content = 
        `${thinkingPrompts.systemPrompt} ${enhancedPrompt.messages[systemMessageIndex].content}`;
    } else {
      // Add new system message
      enhancedPrompt.messages.unshift({
        role: 'system',
        content: thinkingPrompts.systemPrompt
      });
    }
    
    // Add thinking instructions to the last user message
    const lastUserMessageIndex = findLastIndex(enhancedPrompt.messages, msg => msg.role === 'user');
    
    if (lastUserMessageIndex >= 0) {
      const userMessage = enhancedPrompt.messages[lastUserMessageIndex];
      const thinkingInstructions = this.generateThinkingInstructions(thinkingPrompts);
      
      enhancedPrompt.messages[lastUserMessageIndex].content = 
        `${userMessage.content}\n\n${thinkingInstructions}`;
    }
    
    return enhancedPrompt;
  }

  /**
   * Enhance Gemini prompt with thinking instructions
   * 
   * @param {Object} platformPrompt - The original Gemini prompt
   * @param {Object} thinkingPrompts - The thinking prompts
   * @returns {Object} - The enhanced prompt
   */
  enhanceGeminiPrompt(platformPrompt, thinkingPrompts) {
    // Clone the platform prompt to avoid modifying the original
    const enhancedPrompt = JSON.parse(JSON.stringify(platformPrompt));
    
    // Find the system message
    const systemMessageIndex = enhancedPrompt.contents.findIndex(msg => msg.role === 'system');
    
    if (systemMessageIndex >= 0) {
      // Enhance existing system message
      enhancedPrompt.contents[systemMessageIndex].parts[0].text = 
        `${thinkingPrompts.systemPrompt} ${enhancedPrompt.contents[systemMessageIndex].parts[0].text}`;
    } else {
      // Add new system message
      enhancedPrompt.contents.unshift({
        role: 'system',
        parts: [{
          text: thinkingPrompts.systemPrompt
        }]
      });
    }
    
    // Add thinking instructions to the last user message
    const lastUserMessageIndex = findLastIndex(enhancedPrompt.contents, msg => msg.role === 'user');
    
    if (lastUserMessageIndex >= 0) {
      const userMessage = enhancedPrompt.contents[lastUserMessageIndex];
      const thinkingInstructions = this.generateThinkingInstructions(thinkingPrompts);
      
      enhancedPrompt.contents[lastUserMessageIndex].parts[0].text = 
        `${userMessage.parts[0].text}\n\n${thinkingInstructions}`;
    }
    
    return enhancedPrompt;
  }

  /**
   * Enhance Copilot prompt with thinking instructions
   * 
   * @param {Object} platformPrompt - The original Copilot prompt
   * @param {Object} thinkingPrompts - The thinking prompts
   * @returns {Object} - The enhanced prompt
   */
  enhanceCopilotPrompt(platformPrompt, thinkingPrompts) {
    // Similar to ChatGPT but with Copilot-specific adjustments
    const enhancedPrompt = JSON.parse(JSON.stringify(platformPrompt));
    
    // Find the system message
    const systemMessageIndex = enhancedPrompt.messages.findIndex(msg => msg.role === 'system');
    
    if (systemMessageIndex >= 0) {
      // Enhance existing system message
      enhancedPrompt.messages[systemMessageIndex].content = 
        `${thinkingPrompts.systemPrompt} ${enhancedPrompt.messages[systemMessageIndex].content}`;
    } else {
      // Add new system message
      enhancedPrompt.messages.unshift({
        role: 'system',
        content: thinkingPrompts.systemPrompt
      });
    }
    
    // Add thinking instructions to the last user message
    const lastUserMessageIndex = findLastIndex(enhancedPrompt.messages, msg => msg.role === 'user');
    
    if (lastUserMessageIndex >= 0) {
      const userMessage = enhancedPrompt.messages[lastUserMessageIndex];
      const thinkingInstructions = this.generateThinkingInstructions(thinkingPrompts);
      
      enhancedPrompt.messages[lastUserMessageIndex].content = 
        `${userMessage.content}\n\n${thinkingInstructions}`;
    }
    
    return enhancedPrompt;
  }

  /**
   * Enhance DeepSeek prompt with thinking instructions
   * 
   * @param {Object} platformPrompt - The original DeepSeek prompt
   * @param {Object} thinkingPrompts - The thinking prompts
   * @returns {Object} - The enhanced prompt
   */
  enhanceDeepSeekPrompt(platformPrompt, thinkingPrompts) {
    // Similar to ChatGPT but with DeepSeek-specific adjustments
    const enhancedPrompt = JSON.parse(JSON.stringify(platformPrompt));
    
    // Find the system message
    const systemMessageIndex = enhancedPrompt.messages.findIndex(msg => msg.role === 'system');
    
    if (systemMessageIndex >= 0) {
      // Enhance existing system message
      enhancedPrompt.messages[systemMessageIndex].content = 
        `${thinkingPrompts.systemPrompt} ${enhancedPrompt.messages[systemMessageIndex].content}`;
    } else {
      // Add new system message
      enhancedPrompt.messages.unshift({
        role: 'system',
        content: thinkingPrompts.systemPrompt
      });
    }
    
    // Add thinking instructions to the last user message
    const lastUserMessageIndex = findLastIndex(enhancedPrompt.messages, msg => msg.role === 'user');
    
    if (lastUserMessageIndex >= 0) {
      const userMessage = enhancedPrompt.messages[lastUserMessageIndex];
      const thinkingInstructions = this.generateThinkingInstructions(thinkingPrompts);
      
      enhancedPrompt.messages[lastUserMessageIndex].content = 
        `${userMessage.content}\n\n${thinkingInstructions}`;
    }
    
    return enhancedPrompt;
  }

  /**
   * Enhance Grok3 prompt with thinking instructions
   * 
   * @param {Object} platformPrompt - The original Grok3 prompt
   * @param {Object} thinkingPrompts - The thinking prompts
   * @returns {Object} - The enhanced prompt
   */
  enhanceGrok3Prompt(platformPrompt, thinkingPrompts) {
    // Similar to ChatGPT but with Grok3-specific adjustments
    const enhancedPrompt = JSON.parse(JSON.stringify(platformPrompt));
    
    // Find the system message
    const systemMessageIndex = enhancedPrompt.messages.findIndex(msg => msg.role === 'system');
    
    if (systemMessageIndex >= 0) {
      // Enhance existing system message
      enhancedPrompt.messages[systemMessageIndex].content = 
        `${thinkingPrompts.systemPrompt} ${enhancedPrompt.messages[systemMessageIndex].content}`;
    } else {
      // Add new system message
      enhancedPrompt.messages.unshift({
        role: 'system',
        content: thinkingPrompts.systemPrompt
      });
    }
    
    // Add thinking instructions to the last user message
    const lastUserMessageIndex = findLastIndex(enhancedPrompt.messages, msg => msg.role === 'user');
    
    if (lastUserMessageIndex >= 0) {
      const userMessage = enhancedPrompt.messages[lastUserMessageIndex];
      const thinkingInstructions = this.generateThinkingInstructions(thinkingPrompts);
      
      enhancedPrompt.messages[lastUserMessageIndex].content = 
        `${userMessage.content}\n\n${thinkingInstructions}`;
    }
    
    return enhancedPrompt;
  }

  /**
   * Enhance Vertix pr
(Content truncated due to size limit. Use line ranges to read in chunks)