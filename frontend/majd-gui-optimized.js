/**
 * Majd GUI - Optimized JavaScript
 * This file contains optimized functionality for the Majd AI interface
 */

// Main Majd GUI Class
class MajdGUI {
    constructor(options = {}) {
        // Default configuration with destructuring for cleaner code
        this.config = {
            apiEndpoint: options.apiEndpoint || '/api/chat',
            streamingEndpoint: options.streamingEndpoint || '/api/chat/stream',
            showReasoning: options.showReasoning || false,
            defaultPlatform: options.defaultPlatform || 'auto',
            enableStreaming: options.enableStreaming !== undefined ? options.enableStreaming : true,
            enableVoiceInput: options.enableVoiceInput !== undefined ? options.enableVoiceInput : true,
            maxMessages: options.maxMessages || 100,
            userId: options.userId || this.generateUserId(),
            wordpressMode: options.wordpressMode || false,
            debounceTime: options.debounceTime || 300,
            typingIndicatorDelay: options.typingIndicatorDelay || 500
        };

        // Cache DOM elements for better performance
        this.cacheElements();

        // State management
        this.state = {
            messages: [],
            isProcessing: false,
            currentStream: null,
            thinkingElement: null,
            speechRecognition: null,
            isListening: false,
            settingsPanelActive: false,
            lastMessageTime: 0
        };

        // Initialize
        this.init();
    }

    // Cache DOM elements for better performance
    cacheElements() {
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
            thinkingTemplate: document.getElementById('majd-thinking-template'),
            fullscreenButton: document.getElementById('majd-fullscreen-btn')
        };
    }

    // Initialize the GUI
    init() {
        // Set up event listeners with debouncing for performance
        this.setupEventListeners();
        
        // Initialize speech recognition if available
        this.initSpeechRecognition();
        
        // Create settings panel
        this.createSettingsPanel();
        
        // Load conversation history from local storage
        this.loadConversation();
        
        // Load user configuration
        this.loadConfig();
        
        // Scroll to bottom of chat
        this.scrollToBottom();
        
        // Focus input field
        if (this.elements.input) {
            this.elements.input.focus();
        }
        
        // Add resize observer for responsive adjustments
        this.setupResizeObserver();
    }

    // Set up event listeners with debouncing for better performance
    setupEventListeners() {
        // Send message on button click
        this.elements.sendButton?.addEventListener('click', this.debounce(() => {
            this.sendMessage();
        }, this.config.debounceTime));

        // Send message on Enter key
        this.elements.input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Clear conversation
        this.elements.clearButton?.addEventListener('click', this.debounce(() => {
            this.clearConversation();
        }, this.config.debounceTime));

        // Toggle reasoning display
        this.elements.toggleReasoningButton?.addEventListener('click', this.debounce(() => {
            this.toggleReasoning();
        }, this.config.debounceTime));

        // Settings button
        this.elements.settingsButton?.addEventListener('click', this.debounce(() => {
            this.toggleSettingsPanel();
        }, this.config.debounceTime));

        // Voice input button
        this.elements.voiceButton?.addEventListener('click', this.debounce(() => {
            this.toggleVoiceInput();
        }, this.config.debounceTime));
        
        // Fullscreen button
        this.elements.fullscreenButton?.addEventListener('click', this.debounce(() => {
            this.toggleFullscreen();
        }, this.config.debounceTime));

        // Close settings panel when clicking outside
        document.addEventListener('click', (e) => {
            const settingsPanel = document.getElementById('majd-settings-panel');
            if (settingsPanel && this.state.settingsPanelActive) {
                if (!settingsPanel.contains(e.target) && e.target !== this.elements.settingsButton) {
                    this.toggleSettingsPanel();
                }
            }
        });
        
        // Add input event listener for typing indicator
        this.elements.input?.addEventListener('input', this.debounce(() => {
            // Implement typing indicator logic if needed
        }, 200));
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key closes fullscreen and settings panel
            if (e.key === 'Escape') {
                if (this.elements.container.classList.contains('majd-fullscreen')) {
                    this.toggleFullscreen(false);
                }
                if (this.state.settingsPanelActive) {
                    this.toggleSettingsPanel();
                }
            }
            
            // Ctrl+Enter to send message
            if (e.key === 'Enter' && e.ctrlKey) {
                this.sendMessage();
            }
        });
    }

    // Debounce function to limit rapid firing of events
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Set up resize observer for responsive adjustments
    setupResizeObserver() {
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(this.debounce(() => {
                this.adjustForScreenSize();
            }, 100));
            
            if (this.elements.container) {
                resizeObserver.observe(this.elements.container);
            }
        } else {
            // Fallback for browsers without ResizeObserver
            window.addEventListener('resize', this.debounce(() => {
                this.adjustForScreenSize();
            }, 100));
        }
    }
    
    // Adjust UI based on screen size
    adjustForScreenSize() {
        const width = window.innerWidth;
        const container = this.elements.container;
        
        if (!container) return;
        
        if (width <= 480) {
            container.classList.add('majd-mobile');
        } else {
            container.classList.remove('majd-mobile');
        }
    }

    // Initialize speech recognition with error handling
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
            try {
                this.state.speechRecognition = new SpeechRecognition();
                this.state.speechRecognition.continuous = false;
                this.state.speechRecognition.interimResults = false;
                
                this.state.speechRecognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    if (this.elements.input) {
                        this.elements.input.value = transcript;
                        this.sendMessage();
                    }
                };
                
                this.state.speechRecognition.onerror = (event) => {
                    console.error('Speech recognition error', event.error);
                    this.state.isListening = false;
                    if (this.elements.voiceButton) {
                        this.elements.voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
                        this.elements.voiceButton.classList.remove('active');
                    }
                };
                
                this.state.speechRecognition.onend = () => {
                    this.state.isListening = false;
                    if (this.elements.voiceButton) {
                        this.elements.voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
                        this.elements.voiceButton.classList.remove('active');
                    }
                };
            } catch (error) {
                console.error('Error initializing speech recognition:', error);
                if (this.elements.voiceButton) {
                    this.elements.voiceButton.style.display = 'none';
                }
            }
        } else {
            console.warn('Speech recognition not supported in this browser');
            if (this.elements.voiceButton) {
                this.elements.voiceButton.style.display = 'none';
            }
        }
    }

    // Create settings panel with improved accessibility
    createSettingsPanel() {
        const settingsPanel = document.createElement('div');
        settingsPanel.id = 'majd-settings-panel';
        settingsPanel.className = 'majd-settings-panel';
        settingsPanel.setAttribute('role', 'dialog');
        settingsPanel.setAttribute('aria-labelledby', 'majd-settings-title');
        
        settingsPanel.innerHTML = `
            <div id="majd-settings-title" class="majd-settings-title">Settings</div>
            
            <div class="majd-settings-option">
                <label class="majd-settings-label" for="majd-platform-select">Default Platform</label>
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
                    <input type="checkbox" id="majd-streaming-checkbox" aria-labelledby="majd-streaming-label">
                    <label id="majd-streaming-label" for="majd-streaming-checkbox">Enable streaming responses</label>
                </div>
            </div>
            
            <div class="majd-settings-option">
                <div class="majd-settings-checkbox">
                    <input type="checkbox" id="majd-reasoning-checkbox" aria-labelledby="majd-reasoning-label">
                    <label id="majd-reasoning-label" for="majd-reasoning-checkbox">Show reasoning process</label>
                </div>
            </div>
            
            <div class="majd-settings-option">
                <div class="majd-settings-checkbox">
                    <input type="checkbox" id="majd-fullscreen-checkbox" aria-labelledby="majd-fullscreen-label">
                    <label id="majd-fullscreen-label" for="majd-fullscreen-checkbox">Fullscreen mode</label>
                </div>
            </div>
        `;
        
        this.elements.container?.appendChild(settingsPanel);
        
        // Set initial values
        const platformSelect = document.getElementById('majd-platform-select');
        const streamingCheckbox = document.getElementById('majd-streaming-checkbox');
        const reasoningCheckbox = document.getElementById('majd-reasoning-checkbox');
        const fullscreenCheckbox = document.getElementById('majd-fullscreen-checkbox');
        
        if (platformSelect) platformSelect.value = this.config.defaultPlatform;
        if (streamingCheckbox) streamingCheckbox.checked = this.config.enableStreaming;
        if (reasoningCheckbox) reasoningCheckbox.checked = this.config.showReasoning;
        if (fullscreenCheckbox) fullscreenCheckbox.checked = this.elements.container?.classList.contains('majd-fullscreen') || false;
        
        // Add event listeners
        platformSelect?.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            this.config.defaultPlatform = target.value;
            this.saveConfig();
        });
        
        streamingCheckbox?.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            this.config.enableStreaming = target.checked;
            this.saveConfig();
        });
        
        reasoningCheckbox?.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            this.config.showReasoning = target.checked;
            this.toggleReasoningDisplay(target.checked);
            this.saveConfig();
        });
        
        fullscreenCheckbox?.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            this.toggleFullscreen(target.checked);
        });
    }

    // Toggle settings panel with animation
    toggleSettingsPanel() {
        const settingsPanel = document.getElementById('majd-settings-panel');
        if (settingsPanel) {
            this.state.settingsPanelActive = !this.state.settingsPanelActive;
            settingsPanel.classList.toggle('active', this.state.settingsPanelActive);
            
            // Set appropriate ARIA attributes
            settingsPanel.setAttribute('aria-hidden', this.state.settingsPanelActive ? 'false' : 'true');
            
            // Focus the first interactive element when opening
            if (this.state.settingsPanelActive) {
                const firstInput = settingsPanel.querySelector('select, input, button') as HTMLElement;
                if (firstInput) {
                    setTimeout(() => {
                        firstInput.focus();
                    }, 100);
                }
            }
        }
    }

    // Toggle fullscreen mode with improved handling
    toggleFullscreen(enabled) {
        const isCurrentlyFullscreen = this.elements.container?.classList.contains('majd-fullscreen') || false;
        
        // If enabled is undefined, toggle the current state
        if (enabled === undefined) {
            enabled = !isCurrentlyFullscreen;
        }
        
        if (this.elements.container) {
            if (enabled) {
                this.elements.container.classList.add('majd-fullscreen');
                if (this.elements.fullscreenButton) {
                    this.elements.fullscreenButton.innerHTML = '<i class="fas fa-compress"></i>';
                    this.elements.fullscreenButton.setAttribute('title', 'Exit fullscreen');
                }
            } els
(Content truncated due to size limit. Use line ranges to read in chunks)