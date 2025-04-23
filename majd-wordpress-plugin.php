<?php
/**
 * Plugin Name: Majd AI Chat Interface
 * Description: Integrates the Majd AI chat interface with WordPress
 * Version: 1.0.0
 * Author: Majd AI
 * Author URI: https://majd-ai.app
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class MajdAI_Plugin {
    private $options;

    public function __construct() {
        // Initialize plugin
        add_action('init', array($this, 'init'));
        
        // Register activation hook
        register_activation_hook(__FILE__, array($this, 'activate'));
        
        // Add shortcode
        add_shortcode('majd_chat', array($this, 'render_chat_interface'));
        
        // Add admin menu
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Register settings
        add_action('admin_init', array($this, 'register_settings'));
        
        // Enqueue scripts and styles
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
    }
    
    public function init() {
        // Load options
        $this->options = get_option('majd_ai_options', array(
            'api_endpoint' => 'https://api.majd-ai.app/api/chat',
            'streaming_endpoint' => 'https://api.majd-ai.app/api/chat/stream',
            'background_color' => '#121212',
            'chat_box_color' => '#FF3333',
            'user_text_color' => '#000000',
            'ai_text_color' => '#AAFF00',
            'enable_streaming' => 'yes',
            'enable_voice' => 'yes',
            'show_reasoning' => 'no',
            'max_messages' => '100'
        ));
    }
    
    public function activate() {
        // Create options if they don't exist
        if (!get_option('majd_ai_options')) {
            add_option('majd_ai_options', array(
                'api_endpoint' => 'https://api.majd-ai.app/api/chat',
                'streaming_endpoint' => 'https://api.majd-ai.app/api/chat/stream',
                'background_color' => '#121212',
                'chat_box_color' => '#FF3333',
                'user_text_color' => '#000000',
                'ai_text_color' => '#AAFF00',
                'enable_streaming' => 'yes',
                'enable_voice' => 'yes',
                'show_reasoning' => 'no',
                'max_messages' => '100'
            ));
        }
        
        // Create assets directory if it doesn't exist
        $upload_dir = wp_upload_dir();
        $majd_dir = $upload_dir['basedir'] . '/majd-ai';
        
        if (!file_exists($majd_dir)) {
            wp_mkdir_p($majd_dir);
        }
    }
    
    public function add_admin_menu() {
        add_menu_page(
            'Majd AI Settings',
            'Majd AI',
            'manage_options',
            'majd-ai',
            array($this, 'render_admin_page'),
            'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#00E5E5" d="M256 48c-110.5 0-200 89.5-200 200s89.5 200 200 200 200-89.5 200-200S366.5 48 256 48zm0 340c-77.3 0-140-62.7-140-140s62.7-140 140-140 140 62.7 140 140-62.7 140-140 140z"/></svg>'),
            30
        );
    }
    
    public function register_settings() {
        register_setting('majd_ai_options', 'majd_ai_options');
        
        // API Settings
        add_settings_section(
            'majd_ai_api_section',
            'API Settings',
            array($this, 'render_api_section'),
            'majd-ai'
        );
        
        add_settings_field(
            'api_endpoint',
            'API Endpoint',
            array($this, 'render_api_endpoint_field'),
            'majd-ai',
            'majd_ai_api_section'
        );
        
        add_settings_field(
            'streaming_endpoint',
            'Streaming Endpoint',
            array($this, 'render_streaming_endpoint_field'),
            'majd-ai',
            'majd_ai_api_section'
        );
        
        // Appearance Settings
        add_settings_section(
            'majd_ai_appearance_section',
            'Appearance Settings',
            array($this, 'render_appearance_section'),
            'majd-ai'
        );
        
        add_settings_field(
            'background_color',
            'Background Color',
            array($this, 'render_background_color_field'),
            'majd-ai',
            'majd_ai_appearance_section'
        );
        
        add_settings_field(
            'chat_box_color',
            'Chat Box Color',
            array($this, 'render_chat_box_color_field'),
            'majd-ai',
            'majd_ai_appearance_section'
        );
        
        add_settings_field(
            'user_text_color',
            'User Text Color',
            array($this, 'render_user_text_color_field'),
            'majd-ai',
            'majd_ai_appearance_section'
        );
        
        add_settings_field(
            'ai_text_color',
            'AI Text Color',
            array($this, 'render_ai_text_color_field'),
            'majd-ai',
            'majd_ai_appearance_section'
        );
        
        // Behavior Settings
        add_settings_section(
            'majd_ai_behavior_section',
            'Behavior Settings',
            array($this, 'render_behavior_section'),
            'majd-ai'
        );
        
        add_settings_field(
            'enable_streaming',
            'Enable Streaming',
            array($this, 'render_enable_streaming_field'),
            'majd-ai',
            'majd_ai_behavior_section'
        );
        
        add_settings_field(
            'enable_voice',
            'Enable Voice Input',
            array($this, 'render_enable_voice_field'),
            'majd-ai',
            'majd_ai_behavior_section'
        );
        
        add_settings_field(
            'show_reasoning',
            'Show Reasoning',
            array($this, 'render_show_reasoning_field'),
            'majd-ai',
            'majd_ai_behavior_section'
        );
        
        add_settings_field(
            'max_messages',
            'Max Messages',
            array($this, 'render_max_messages_field'),
            'majd-ai',
            'majd_ai_behavior_section'
        );
    }
    
    public function render_api_section() {
        echo '<p>Configure the API endpoints for connecting to the Majd AI backend.</p>';
    }
    
    public function render_appearance_section() {
        echo '<p>Customize the appearance of the Majd AI chat interface.</p>';
    }
    
    public function render_behavior_section() {
        echo '<p>Configure how the Majd AI chat interface behaves.</p>';
    }
    
    public function render_api_endpoint_field() {
        $value = isset($this->options['api_endpoint']) ? $this->options['api_endpoint'] : '';
        echo '<input type="text" class="regular-text" name="majd_ai_options[api_endpoint]" value="' . esc_attr($value) . '" />';
        echo '<p class="description">The endpoint for sending chat messages (e.g., https://api.majd-ai.app/api/chat)</p>';
    }
    
    public function render_streaming_endpoint_field() {
        $value = isset($this->options['streaming_endpoint']) ? $this->options['streaming_endpoint'] : '';
        echo '<input type="text" class="regular-text" name="majd_ai_options[streaming_endpoint]" value="' . esc_attr($value) . '" />';
        echo '<p class="description">The endpoint for streaming responses (e.g., https://api.majd-ai.app/api/chat/stream)</p>';
    }
    
    public function render_background_color_field() {
        $value = isset($this->options['background_color']) ? $this->options['background_color'] : '#121212';
        echo '<input type="color" name="majd_ai_options[background_color]" value="' . esc_attr($value) . '" />';
        echo '<p class="description">The background color of the chat interface (default: #121212 - black)</p>';
    }
    
    public function render_chat_box_color_field() {
        $value = isset($this->options['chat_box_color']) ? $this->options['chat_box_color'] : '#FF3333';
        echo '<input type="color" name="majd_ai_options[chat_box_color]" value="' . esc_attr($value) . '" />';
        echo '<p class="description">The color of user message bubbles (default: #FF3333 - red)</p>';
    }
    
    public function render_user_text_color_field() {
        $value = isset($this->options['user_text_color']) ? $this->options['user_text_color'] : '#000000';
        echo '<input type="color" name="majd_ai_options[user_text_color]" value="' . esc_attr($value) . '" />';
        echo '<p class="description">The color of text in user messages (default: #000000 - black)</p>';
    }
    
    public function render_ai_text_color_field() {
        $value = isset($this->options['ai_text_color']) ? $this->options['ai_text_color'] : '#AAFF00';
        echo '<input type="color" name="majd_ai_options[ai_text_color]" value="' . esc_attr($value) . '" />';
        echo '<p class="description">The color of text in AI responses (default: #AAFF00 - light green)</p>';
    }
    
    public function render_enable_streaming_field() {
        $value = isset($this->options['enable_streaming']) ? $this->options['enable_streaming'] : 'yes';
        echo '<input type="checkbox" name="majd_ai_options[enable_streaming]" value="yes" ' . checked($value, 'yes', false) . ' />';
        echo '<p class="description">Enable streaming responses (shows AI responses as they\'re generated)</p>';
    }
    
    public function render_enable_voice_field() {
        $value = isset($this->options['enable_voice']) ? $this->options['enable_voice'] : 'yes';
        echo '<input type="checkbox" name="majd_ai_options[enable_voice]" value="yes" ' . checked($value, 'yes', false) . ' />';
        echo '<p class="description">Enable voice input (allows users to speak their questions)</p>';
    }
    
    public function render_show_reasoning_field() {
        $value = isset($this->options['show_reasoning']) ? $this->options['show_reasoning'] : 'no';
        echo '<input type="checkbox" name="majd_ai_options[show_reasoning]" value="yes" ' . checked($value, 'yes', false) . ' />';
        echo '<p class="description">Show AI reasoning process (displays step-by-step thinking)</p>';
    }
    
    public function render_max_messages_field() {
        $value = isset($this->options['max_messages']) ? $this->options['max_messages'] : '100';
        echo '<input type="number" name="majd_ai_options[max_messages]" value="' . esc_attr($value) . '" min="10" max="500" step="10" />';
        echo '<p class="description">Maximum number of messages to store in conversation history</p>';
    }
    
    public function render_admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        
        if (isset($_GET['settings-updated'])) {
            add_settings_error('majd_ai_messages', 'majd_ai_message', 'Settings Saved', 'updated');
        }
        
        settings_errors('majd_ai_messages');
        ?>
        <div class="wrap majd-admin">
            <div class="majd-admin-header">
                <img src="<?php echo esc_url(plugins_url('assets/majd full logo_Transparent.png', __FILE__)); ?>" alt="Majd AI Logo">
                <h1 class="majd-admin-title"><?php echo esc_html(get_admin_page_title()); ?></h1>
            </div>
            
            <form action="options.php" method="post">
                <?php
                settings_fields('majd_ai_options');
                do_settings_sections('majd-ai');
                submit_button('Save Settings');
                ?>
            </form>
            
            <div class="majd-admin-section">
                <h2 class="majd-admin-section-title">Shortcode Usage</h2>
                <p>Use the following shortcode to add the Majd AI chat interface to any page or post:</p>
                <code>[majd_chat]</code>
                
                <p>You can customize the appearance and behavior with additional parameters:</p>
                <code>[majd_chat height="600px" width="100%" welcome_message="Hello! How can I help you today?"]</code>
                
                <h3>Available Parameters:</h3>
                <ul>
                    <li><strong>height</strong>: Height of the chat interface (default: "500px")</li>
                    <li><strong>width</strong>: Width of the chat interface (default: "100%")</li>
                    <li><strong>welcome_message</strong>: Custom welcome message</li>
                    <li><strong>force_styles</strong>: Set to "true" to force custom styles (useful for theme conflicts)</li>
                </ul>
            </div>
        </div>
        <?php
    }
    
    public function enqueue_scripts() {
        // Register and enqueue styles
        wp_register_style(
            'majd-ai-style',
            plugins_url('assets/majd-gui-optimized.css', __FILE__),
            array(),
            '1.0.0'
        );
        wp_enqueue_style('majd-ai-style');
        
        // Register and enqueue scripts
        wp_register_script(
            'majd-ai-script',
            plugins_url('assets/majd-gui-optimized.js', __FILE__),
            array('jquery'),
            '1.0.0',
            true
        );
        wp_enqueue_script('majd-ai-script');
        
        // Add inline CSS for custom colors
        $custom_css = "
            :root {
                --background-color: {$this->options['background_color']};
                --chat-box-color: {$this->options['chat_box_color']};
                --user-text-color: {$this->options['user_text_color']};
                --ai-text-color: {$this->options['ai_text_color']};
            }
        ";
        wp_add_inline_style('majd-ai-style', $custom_css);
    }
    
    public function enqueue_admin_scripts($hook) {
        if ('toplevel_page_majd-ai' !== $hook) {
            return;
        }
        
        // Register and enqueue admin styles
        wp_register_style(
            'majd-ai-admin-style',
            plugins_url('assets/majd-gui-optimized.css', __FILE__),
            array(),
            '1.0.0'
        );
        wp_enqueue_style('majd-ai-admin-style');
        
        // Add inline CSS for admin page
        $custom_css = "
            .majd-admin {
                background-color: #121212;
                color: white;
                padding: 20px;
                border-radius: 10px;
                max-width: 1200px;
            }
            
            .majd-admin-header {
                display: flex;
                align-items: center;
                margin-bottom: 24px;
            }
            
            .majd-admin-header img {
                height: 40px;
                margin-right: 16px;
            }
            
            .majd-admin-title {
                font-size: 24px;
                font-weight: 600;
                color: #00E5E5;
            }
            
            .majd-admin-section {
                background-color: #1A1A1A;
                border-radius: 8px;
                padding: 20px;
                margin-top: 24px;
            }
            
            .majd-admin-section-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 16px;
                color: #00E5E5;
            }
            
            .form-table th {
                color: white;
            }
            
            .form-table td {
                color: #CCC;
            }
            
            .description {
                color: #999;
            }
            
            input[type=text], input[type=number], select {
                background-color: #2A2A2A;
                border: 1px solid #333;
                color: white;
            }
            
            input[type=text]:focus, input[type=number]:focus, select:focus {
                border-color: #00E5E5;
                box-shadow: 0 0 0 1px #00E5E5;
            }
            
            .button-primary {
                background: linear-gradient(to right, #00E5E5, #6A0DAD);
                border: none;
                text-shadow: none;
                box-shadow: none;
            }
            
            .button-primary:hover, .button-primary:focus {
                background: linear-gradient(to right, #00D0D0, #5A0C9D);
                border: none;
                box-shadow: 0 0 0 1px white;
            }
        ";
        wp_add_inline_style('majd-ai-admin-style', $custom_css);
    }
    
    public function render_chat_interface($atts) {
        $atts = shortcode_atts(array(
            'height' => '500px',
            'width' => '100%',
            'welcome_message' => '',
            'force_styles' => 'false'
        ), $atts, 'majd_chat');
        
        // Generate a unique ID for this instance
        $container_id = 'majd-container-' . uniqid();
        
        // Prepare JavaScript initialization
        $script = "
            jQuery(document).ready(function($) {
                new MajdGUI({
                    containerId: '{$container_id}',
                    apiEndpoint: '{$this->options['api_endpoint']}',
                    streamingEndpoint: '{$this->options['streaming_endpoint']}',
                    enableStreaming: " . ($this->options['enable_streaming'] === 'yes' ? 'true' : 'false') . ",
                    enableVoice: " . ($this->options['enable_voice'] === 'yes' ? 'true' : 'false') . ",
                    showReasoning: " . ($this->options['show_reasoning'] === 'yes' ? 'true' : 'false') . ",
                    maxMessages: {$this->options['max_messages']},
                    " . ($atts['welcome_message'] ? "welcomeMessage: '" . esc_js($atts['welcome_message']) . "'," : "") . "
                    assetsPath: '" . esc_js(plugins_url('assets/', __FILE__)) . "'
                });
            });
        ";
        wp_add_inline_script('majd-ai-script', $script);
        
        // Prepare inline styles
        $style = "
            #{$container_id} {
                height: {$atts['height']};
                width: {$atts['width']};
                margin: 0 auto;
            }
        ";
        
        if ($atts['force_styles'] === 'true') {
            $style .= "
                #{$container_id} * {
                    box-sizing: border-box;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                }
            ";
        }
        
        wp_add_inline_style('majd-ai-style', $style);
        
        // Return the container HTML
        return '<div id="' . esc_attr($container_id) . '"></div>';
    }
}

// Initialize the plugin
new MajdAI_Plugin();
