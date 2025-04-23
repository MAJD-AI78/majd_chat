/* Majd AI Chat Interface - Main JavaScript
 * Updated version with platform references removed
 */

class MajdGUI {
  constructor(options = {}) {
    this.options = {
      containerId: options.containerId || 'majd-container',
      apiEndpoint: options.apiEndpoint || 'https://api.majd-ai.app/api/chat',
      streamingEndpoint: options.streamingEndpoint || 'https://api.majd-ai.app/api/chat/stream',
      enableStreaming: options.enableStreaming !== undefined ? options.enableStreaming : true,
      enableVoice: options.enableVoice !== undefined ? options.enableVoice : true,
      showReasoning: options.showReasoning !== undefined ? options.showReasoning : false,
      welcomeMessage: options.welcomeMessage || 'Hello! I\'m Majd AI, your intelligent assistant. How can I help you today?',
      maxMessages: options.maxMessages || 100,
      assetsPath: options.assetsPath || './assets/'
    };
    
    this.container = document.getElementById(this.options.containerId);
    this.messages = [];
    this.isThinking = false;
    this.isRecording = false;
    this.recognition = null;
    this.currentStream = null;
    this.streamController = null;
    
    this.init();
  }
  
  init() {
    if (!this.container) {
      console.error('Majd container not found');
      return;
    }
    
    this.renderUI();
    this.attachEventListeners();
    this.setupVoiceRecognition();
    this.showWelcomeMessage();
  }
  
  renderUI() {
    this.container.classList.add('majd-container');
    this.container.innerHTML = `
      <div class="majd-header">
        <div class="majd-logo">
          <img src="${this.options.assetsPath}majd_IconOnly_Transparent.png" alt="Majd AI Logo">
          <span class="majd-logo-text">Majd AI</span>
        </div>
        <div class="majd-controls">
          <button class="majd-control-button majd-reasoning-toggle" title="Toggle reasoning">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4a2 2 0 0 1 2-2h2"></path>
              <circle cx="12" cy="8" r="2"></circle>
              <path d="M12 10v4"></path>
            </svg>
          </button>
          <button class="majd-control-button majd-fullscreen-toggle" title="Toggle fullscreen">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
              <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
              <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
              <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="majd-chat-area"></div>
      <div class="majd-input-area">
        <div class="majd-input-container">
          ${this.options.enableVoice ? `
          <button class="majd-voice-button" title="Voice input">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
          </button>
          ` : ''}
          <textarea class="majd-input" placeholder="Type your message..." rows="1"></textarea>
          <button class="majd-send-button" title="Send message" disabled>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    this.chatArea = this.container.querySelector('.majd-chat-area');
    this.input = this.container.querySelector('.majd-input');
    this.sendButton = this.container.querySelector('.majd-send-button');
    this.voiceButton = this.container.querySelector('.majd-voice-button');
    this.reasoningToggle = this.container.querySelector('.majd-reasoning-toggle');
    this.fullscreenToggle = this.container.querySelector('.majd-fullscreen-toggle');
    
    if (this.options.showReasoning) {
      this.reasoningToggle.classList.add('active');
    }
  }
  
  attachEventListeners() {
    // Send button
    this.sendButton.addEventListener('click', () => {
      this.sendMessage();
    });
    
    // Input field
    this.input.addEventListener('input', () => {
      this.resizeInput();
      this.sendButton.disabled = !this.input.value.trim();
    });
    
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!this.sendButton.disabled) {
          this.sendMessage();
        }
      }
    });
    
    // Voice button
    if (this.voiceButton) {
      this.voiceButton.addEventListener('click', () => {
        this.toggleVoiceInput();
      });
    }
    
    // Reasoning toggle
    this.reasoningToggle.addEventListener('click', () => {
      this.options.showReasoning = !this.options.showReasoning;
      this.reasoningToggle.classList.toggle('active', this.options.showReasoning);
      
      // Update existing messages to show/hide reasoning
      const reasoningElements = this.chatArea.querySelectorAll('.majd-reasoning');
      reasoningElements.forEach(el => {
        el.style.display = this.options.showReasoning ? 'block' : 'none';
      });
    });
    
    // Fullscreen toggle
    this.fullscreenToggle.addEventListener('click', () => {
      this.container.classList.toggle('majd-fullscreen');
      
      // Scroll to bottom when entering fullscreen
      if (this.container.classList.contains('majd-fullscreen')) {
        this.scrollToBottom();
      }
    });
  }
  
  setupVoiceRecognition() {
    if (!this.options.enableVoice) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      this.voiceButton.style.display = 'none';
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    
    this.recognition.onstart = () => {
      this.isRecording = true;
      this.voiceButton.classList.add('recording');
      this.input.placeholder = 'Listening...';
    };
    
    this.recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');
      
      this.input.value = transcript;
      this.resizeInput();
      this.sendButton.disabled = !transcript.trim();
    };
    
    this.recognition.onend = () => {
      this.isRecording = false;
      this.voiceButton.classList.remove('recording');
      this.input.placeholder = 'Type your message...';
      
      // Auto-send if we have content
      if (!this.sendButton.disabled) {
        setTimeout(() => this.sendMessage(), 500);
      }
    };
    
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      this.isRecording = false;
      this.voiceButton.classList.remove('recording');
      this.input.placeholder = 'Type your message...';
    };
  }
  
  toggleVoiceInput() {
    if (!this.recognition) return;
    
    if (this.isRecording) {
      this.recognition.stop();
    } else {
      this.recognition.start();
    }
  }
  
  resizeInput() {
    // Reset height to auto to get the correct scrollHeight
    this.input.style.height = 'auto';
    
    // Set new height based on scrollHeight (with max height limit)
    const newHeight = Math.min(this.input.scrollHeight, 150);
    this.input.style.height = `${newHeight}px`;
  }
  
  showWelcomeMessage() {
    this.chatArea.innerHTML = `
      <div class="majd-welcome majd-fade-in">
        <img src="${this.options.assetsPath}majd full logo_Transparent.png" alt="Majd AI" class="majd-welcome-logo">
        <h2 class="majd-welcome-title">Welcome to Majd AI</h2>
        <p class="majd-welcome-subtitle">Command the edge of intelligence with our advanced AI platform that delivers exceptional reasoning, research, and problem-solving capabilities.</p>
        <div class="majd-welcome-suggestions">
          <div class="majd-suggestion">How can Majd help me?</div>
          <div class="majd-suggestion">What makes Majd different?</div>
          <div class="majd-suggestion">Tell me about your capabilities</div>
          <div class="majd-suggestion">Solve a complex problem</div>
        </div>
      </div>
    `;
    
    // Add click event to suggestions
    const suggestions = this.chatArea.querySelectorAll('.majd-suggestion');
    suggestions.forEach(suggestion => {
      suggestion.addEventListener('click', () => {
        this.input.value = suggestion.textContent;
        this.resizeInput();
        this.sendButton.disabled = false;
        this.sendMessage();
      });
    });
  }
  
  addMessage(message) {
    // Clear welcome screen if this is the first message
    if (this.messages.length === 0) {
      this.chatArea.innerHTML = '';
    }
    
    this.messages.push(message);
    
    // Limit number of messages
    if (this.messages.length > this.options.maxMessages) {
      this.messages.shift();
      // Remove first message from DOM if it exists
      const firstMessage = this.chatArea.querySelector('.majd-message');
      if (firstMessage) {
        firstMessage.remove();
      }
    }
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('majd-message', `majd-message-${message.role}`, 'majd-fade-in');
    
    let messageHTML = `
      <div class="majd-message-content">${this.formatMessageContent(message.content)}</div>
    `;
    
    if (message.role === 'ai') {
      messageHTML += `
        <div class="majd-message-meta">
          <span class="majd-message-timestamp">${new Date().toLocaleTimeString()}</span>
        </div>
      `;
    }
    
    if (message.role === 'ai' && message.reasoning && this.options.showReasoning) {
      messageHTML += `
        <div class="majd-reasoning">
          <div class="majd-reasoning-title">Reasoning Process</div>
          <div class="majd-reasoning-content">${this.formatMessageContent(message.reasoning)}</div>
        </div>
      `;
    } else if (message.role === 'ai' && message.reasoning) {
      // Add hidden reasoning
      messageHTML += `
        <div class="majd-reasoning" style="display: none;">
          <div class="majd-reasoning-title">Reasoning Process</div>
          <div class="majd-reasoning-content">${this.formatMessageContent(message.reasoning)}</div>
        </div>
      `;
    }
    
    messageElement.innerHTML = messageHTML;
    this.chatArea.appendChild(messageElement);
    this.scrollToBottom();
  }
  
  formatMessageContent(content) {
    if (!content) return '';
    
    // Replace newlines with <br>
    let formatted = content.replace(/\n/g, '<br>');
    
    // Format code blocks
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, language, code) => {
      const lang = language || 'plaintext';
      return `
        <div class="majd-code">
          <div class="majd-code-header">
            <span>${lang}</span>
            <button class="majd-code-copy" onclick="navigator.clipboard.writeText(\`${code.replace(/`/g, '\\`')}\`)">Copy</button>
          </div>
          <pre><code>${code}</code></pre>
        </div>
      `;
    });
    
    // Format inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    return formatted;
  }
  
  showThinking() {
    if (this.isThinking) return;
    
    this.isThinking = true;
    const thinkingElement = document.createElement('div');
    thinkingElement.classList.add('majd-thinking');
    thinkingElement.innerHTML = `
      <div class="majd-thinking-dot"></div>
      <div class="majd-thinking-dot"></div>
      <div class="majd-thinking-dot"></div>
    `;
    
    this.chatArea.appendChild(thinkingElement);
    this.scrollToBottom();
  }
  
  hideThinking() {
    if (!this.isThinking) return;
    
    this.isThinking = false;
    const thinkingElement = this.chatArea.querySelector('.majd-thinking');
    if (thinkingElement) {
      thinkingElement.remove();
    }
  }
  
  scrollToBottom() {
    this.chatArea.scrollTop = this.chatArea.scrollHeight;
  }
  
  async sendMessage() {
    const message = this.input.value.trim();
    if (!message) return;
    
    // Add user message to chat
    this.addMessage({
      role: 'user',
      content: message
    });
    
    // Clear input
    this.input.value = '';
    this.resizeInput();
    this.sendButton.disabled = true;
    
    // Show thinking indicator
    this.showThinking();
    
    try {
      if (this.options.enableStreaming) {
        await this.sendStreamingRequest(message);
      } else {
        await this.sendRegularRequest(message);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      this.hideThinking();
      
      // Add error message
      this.addMessage({
        role: 'ai',
        content: 'Sorry, I encountered an error while processing your request. Please try again later.'
      });
    }
  }
  
  async sendRegularRequest(message) {
    const response = await fetch(this.options.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    this.hideThinking();
    
    this.addMessage({
      role: 'ai',
      content: data.response,
      reasoning: data.reasoning
    });
  }
  
  async sendStreamingRequest(message) {
    // Cancel any existing stream
    if (this.currentStream) {
      this.streamController.abort();
    }
    
    // Create a new abort controller
    this.streamController = new AbortController();
    const signal = this.streamController.signal;
    
    const response = await fetch(this.options.streamingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message
      }),
      signal
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = '';
    let reasoning = '';
    let aiMessageAdded = false;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // Decode the chunk and process it
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = JSON.parse(line.substring(5).trim());
            
            if (data.type === 'content') {
              responseText += data.content;
              
              if (!aiMessageAdded) {
                this.hideThinking();
                this.addMessage({
                  role: 'ai',
                  content: responseText
                });
                aiMessageAdded = true;
              } else {
                // Update the last message
                const lastMessage = this.chatArea.querySelector('.majd-message:last-child .majd-message-content');
                if (lastMessage) {
                  lastMessage.innerHTML = this.formatMessageContent(responseText);
                  this.scrollToBottom();
                }
              }
            } else if (data.type === 'reasoning') {
              reasoning += data.content;
            } else if (data.type === 'done') {
              // Final update with all content
              if (aiMessageAdded) {
                // Remove the last message
                const lastMessage = this.chatArea.querySelector('.majd-message:last-child');
                if (lastMessage) {
                  lastMessage.remove();
                }
              }
              
              // Add the complete message
              this.addMessage({
                role: 'ai',
                content: responseText,
                reasoning: reasoning
              });
            }
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Stream aborted');
      } else {
        throw error;
      }
    }
    
    this.currentStream = null;
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MajdGUI;
}
