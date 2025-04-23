/**
 * Majd GUI - JavaScript Functionality
 * This file contains all the interactive functionality for the Majd AI interface
 */

// Main Majd GUI Class
class MajdGUI {
    constructor(options = {}) {
        // Default configuration
        this.config = {
            apiEndpoint: options.apiEndpoint || '/api/chat',
            streamingEndpoint: options.streamingEndpoint || '/api/chat/stream',
            showReasoning: options.showReasoning || false,
            defaultPlatform: options.defaultPlatform || 'auto',
            enableStreaming: options.enableStreaming !== undefined ? options.enableStreaming : true,
            enableVoiceInput: options.enableVoiceInput !== undefined ? options.enableVoiceInput : true,
            maxMessages: options.maxMessages || 100,
            userId: options.userId || this.generateUserId(),
            wordpressMode: options.wordpressMode || false
        };

        // DOM Elements
        this.elements = {
            container: document.getElementById('majd-container'),
            chatArea: document.getElementById('majd-chat-area'),
            input: document.getElementById('majd-input'),
            sendButton: document.getElementById('majd-send-btn'),
            clearButton: document.getElementById('majd-clear-btn'),
            toggleReasoningButton: document.getElementById('majd-toggle-reasoning-btn'),
            settingsButton: document.getElementById('majd-settings-btn'),
            voiceButton: document.getElementById('majd-voice-btn'),
            userMessageTemplate: document.getElementById('majd-user-message-template'),
            aiMessageTemplate: document.getElementById('majd-ai-message-template'),
            thinkingTemplate: document.getElementById('majd-thinking-template')
        };

        // State
        this.state = {
            messages: [],
            isProcessing: false,
            currentStream: null,
            thinkingElement: null,
            speechRecognition: null,
            isListening: false,
            settingsPanelActive: false
        };

        // Initialize
        this.init();
    }

    // Initialize the GUI
    init() {
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize speech recognition if available
        this.initSpeechRecognition();
        
        // Create settings panel
        this.createSettingsPanel();
        
        // Load conversation history from local storage
        this.loadConversation();
        
        // Scroll to bottom of chat
        this.scrollToBottom();
    }

    // Set up event listeners
    setupEventListeners() {
        // Send message on button click
        this.elements.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // Send message on Enter key
        this.elements.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Clear conversation
        this.elements.clearButton.addEventListener('click', () => {
            this.clearConversation();
        });

        // Toggle reasoning display
        this.elements.toggleReasoningButton.addEventListener('click', () => {
            this.toggleReasoning();
        });

        // Settings button
        this.elements.settingsButton.addEventListener('click', () => {
            this.toggleSettingsPanel();
        });

        // Voice input button
        if (this.elements.voiceButton) {
            this.elements.voiceButton.addEventListener('click', () => {
                this.toggleVoiceInput();
            });
        }

        // Close settings panel when clicking outside
        document.addEventListener('click', (e) => {
            const settingsPanel = document.getElementById('majd-settings-panel');
            if (settingsPanel && this.state.settingsPanelActive) {
                if (!settingsPanel.contains(e.target) && e.target !== this.elements.settingsButton) {
                    this.toggleSettingsPanel();
                }
            }
        });
    }

    // Initialize speech recognition
    initSpeechRecognition() {
        if (!this.config.enableVoiceInput) {
            if (this.elements.voiceButton) {
                this.elements.voiceButton.style.display = 'none';
            }
            return;
        }

        // Check if browser supports speech recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            this.state.speechRecognition = new SpeechRecognition();
            this.state.speechRecognition.continuous = false;
            this.state.speechRecognition.interimResults = false;
            
            this.state.speechRecognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.elements.input.value = transcript;
                this.sendMessage();
            };
            
            this.state.speechRecognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                this.state.isListening = false;
                if (this.elements.voiceButton) {
                    this.elements.voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
                }
            };
            
            this.state.speechRecognition.onend = () => {
                this.state.isListening = false;
                if (this.elements.voiceButton) {
                    this.elements.voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
                }
            };
        } else {
            console.warn('Speech recognition not supported in this browser');
            if (this.elements.voiceButton) {
                this.elements.voiceButton.style.display = 'none';
            }
        }
    }

    // Create settings panel
    createSettingsPanel() {
        const settingsPanel = document.createElement('div');
        settingsPanel.id = 'majd-settings-panel';
        settingsPanel.className = 'majd-settings-panel';
        
        settingsPanel.innerHTML = `
            <div class="majd-settings-title">Settings</div>
            
            <div class="majd-settings-option">
                <label class="majd-settings-label">Default Platform</label>
                <select id="majd-platform-select" class="majd-settings-select">
                    <option value="auto">Auto (Recommended)</option>
                    <option value="chatgpt">ChatGPT</option>
                    <option value="perplexity">Perplexity</option>
                    <option value="gemini">Gemini</option>
                    <option value="copilot">GitHub Copilot</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="grok3">Grok3</option>
                    <option value="vertix">Vertix</option>
                </select>
            </div>
            
            <div class="majd-settings-option">
                <div class="majd-settings-checkbox">
                    <input type="checkbox" id="majd-streaming-checkbox">
                    <label for="majd-streaming-checkbox">Enable streaming responses</label>
                </div>
            </div>
            
            <div class="majd-settings-option">
                <div class="majd-settings-checkbox">
                    <input type="checkbox" id="majd-reasoning-checkbox">
                    <label for="majd-reasoning-checkbox">Show reasoning process</label>
                </div>
            </div>
            
            <div class="majd-settings-option">
                <div class="majd-settings-checkbox">
                    <input type="checkbox" id="majd-fullscreen-checkbox">
                    <label for="majd-fullscreen-checkbox">Fullscreen mode</label>
                </div>
            </div>
        `;
        
        this.elements.container.appendChild(settingsPanel);
        
        // Set initial values
        document.getElementById('majd-platform-select').value = this.config.defaultPlatform;
        document.getElementById('majd-streaming-checkbox').checked = this.config.enableStreaming;
        document.getElementById('majd-reasoning-checkbox').checked = this.config.showReasoning;
        
        // Add event listeners
        document.getElementById('majd-platform-select').addEventListener('change', (e) => {
            this.config.defaultPlatform = e.target.value;
            this.saveConfig();
        });
        
        document.getElementById('majd-streaming-checkbox').addEventListener('change', (e) => {
            this.config.enableStreaming = e.target.checked;
            this.saveConfig();
        });
        
        document.getElementById('majd-reasoning-checkbox').addEventListener('change', (e) => {
            this.config.showReasoning = e.target.checked;
            this.toggleReasoningDisplay(e.target.checked);
            this.saveConfig();
        });
        
        document.getElementById('majd-fullscreen-checkbox').addEventListener('change', (e) => {
            this.toggleFullscreen(e.target.checked);
        });
    }

    // Toggle settings panel
    toggleSettingsPanel() {
        const settingsPanel = document.getElementById('majd-settings-panel');
        if (settingsPanel) {
            this.state.settingsPanelActive = !this.state.settingsPanelActive;
            settingsPanel.classList.toggle('active', this.state.settingsPanelActive);
        }
    }

    // Toggle fullscreen mode
    toggleFullscreen(enabled) {
        if (enabled) {
            this.elements.container.classList.add('majd-fullscreen');
        } else {
            this.elements.container.classList.remove('majd-fullscreen');
        }
        this.scrollToBottom();
    }

    // Toggle voice input
    toggleVoiceInput() {
        if (!this.state.speechRecognition) return;
        
        if (this.state.isListening) {
            this.state.speechRecognition.stop();
            this.state.isListening = false;
            this.elements.voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        } else {
            this.state.speechRecognition.start();
            this.state.isListening = true;
            this.elements.voiceButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        }
    }

    // Send message to API
    sendMessage() {
        const message = this.elements.input.value.trim();
        if (!message || this.state.isProcessing) return;
        
        // Add user message to chat
        this.addUserMessage(message);
        
        // Clear input
        this.elements.input.value = '';
        
        // Show thinking indicator
        this.showThinking();
        
        // Set processing state
        this.state.isProcessing = true;
        
        // Determine whether to use streaming
        if (this.config.enableStreaming) {
            this.sendStreamingRequest(message);
        } else {
            this.sendStandardRequest(message);
        }
    }

    // Send standard (non-streaming) request
    sendStandardRequest(message) {
        const requestData = {
            message: message,
            userId: this.config.userId,
            options: {
                includeThinking: this.config.showReasoning,
                overridePlatform: this.config.defaultPlatform !== 'auto' ? this.config.defaultPlatform : undefined
            }
        };
        
        fetch(this.config.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Remove thinking indicator
            this.removeThinking();
            
            // Add AI response to chat
            this.addAIMessage(data.formattedResponse, data.routingInfo?.platform, data.thinkingProcess);
            
            // Update state
            this.state.isProcessing = false;
        })
        .catch(error => {
            console.error('Error sending message:', error);
            
            // Remove thinking indicator
            this.removeThinking();
            
            // Add error message
            this.addAIMessage('Sorry, I encountered an error while processing your request. Please try again.', 'error');
            
            // Update state
            this.state.isProcessing = false;
        });
    }

    // Send streaming request
    sendStreamingRequest(message) {
        const requestData = {
            message: message,
            userId: this.config.userId,
            options: {
                includeThinking: this.config.showReasoning,
                overridePlatform: this.config.defaultPlatform !== 'auto' ? this.config.defaultPlatform : undefined
            }
        };
        
        // Create AI message element for streaming
        const aiMessageElement = this.createAIMessageElement('', '');
        this.elements.chatArea.appendChild(aiMessageElement);
        
        // Remove thinking indicator
        this.removeThinking();
        
        // Get content element for updating
        const contentElement = aiMessageElement.querySelector('.majd-message-content');
        const platformIndicator = aiMessageElement.querySelector('.majd-platform-indicator');
        const reasoningElement = aiMessageElement.querySelector('.majd-reasoning');
        const reasoningContent = aiMessageElement.querySelector('.majd-reasoning-content');
        
        // Initialize content
        let fullContent = '';
        let platform = '';
        let reasoning = '';
        
        // Set up EventSource for SSE
        const eventSource = new EventSource(`${this.config.streamingEndpoint}?data=${encodeURIComponent(JSON.stringify(requestData))}`);
        
        // Store current stream
        this.state.currentStream = eventSource;
        
        // Handle incoming messages
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'chunk') {
                // Update content
                fullContent += data.content;
                contentElement.textContent = fullContent;
                
                // Update platform if available
                if (data.metadata && data.metadata.platform && !platform) {
                    platform = data.metadata.platform;
                    platformIndicator.textContent = `Powered by ${this.getPlatformName(platform)}`;
                }
                
                // Scroll to bottom
                this.scrollToBottom();
            } else if (data.type === 'end') {
                // Complete the response
                if (data.response.thinkingProcess && this.config.showReasoning) {
                    reasoning = data.response.thinkingProcess;
                    reasoningContent.textContent = reasoning;
                    reasoningElement.style.display = 'block';
                }
                
                // Close the connection
                eventSource.close();
                this.state.currentStream = null;
                this.state.isProcessing = false;
                
                // Save the conversation
                this.saveConversation();
            } else if (data.type === 'error') {
                // Handle error
                contentElement.textContent = 'Sorry, I encountered an error while processing your request. Please try again.';
                platformIndicator.textContent = 'Error';
                
                // Close
(Content truncated due to size limit. Use line ranges to read in chunks)