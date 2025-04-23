# Majd Branded GUI Deployment Guide

This guide provides instructions for deploying the branded Majd GUI with the official Majd logo and styling. The implementation includes both WordPress plugin integration and standalone HTML options.

## Table of Contents
1. [Files Overview](#files-overview)
2. [WordPress Plugin Deployment](#wordpress-plugin-deployment)
3. [Standalone HTML Deployment](#standalone-html-deployment)
4. [Customization Options](#customization-options)
5. [Troubleshooting](#troubleshooting)

## Files Overview

The branded Majd GUI package includes the following files:

- **Core Files**:
  - `majd-gui.css` - Main stylesheet with Majd branding and color scheme
  - `majd-gui.js` - JavaScript functionality for the chat interface
  - `index.html` - Example standalone HTML implementation
  
- **WordPress Integration**:
  - `majd-wordpress-plugin.php` - WordPress plugin with Majd branding

- **Assets**:
  - `assets/majd full logo.png` - Full logo with background
  - `assets/majd full logo_Transparent.png` - Full logo with transparent background
  - `assets/majd_IconOnly_Transparent.png` - Icon-only logo with transparent background
  - `assets/majd_IconOnly (1).png` - Icon-only logo with background

## WordPress Plugin Deployment

### Step 1: Prepare Plugin Directory
1. Connect to your WordPress site via FTP
2. Navigate to `/wp-content/plugins/`
3. Create a new directory called `majd-ai`

### Step 2: Upload Plugin Files
1. Upload `majd-wordpress-plugin.php` to the `majd-ai` directory
2. Create a subdirectory called `assets` inside the `majd-ai` directory
3. Upload all logo files to the `assets` directory
4. Upload `majd-gui.css` and `majd-gui.js` to the `assets` directory, renaming them to:
   - `majd-gui-optimized.css`
   - `majd-gui-optimized.js`

Your directory structure should look like:
```
wp-content/plugins/majd-ai/
├── majd-wordpress-plugin.php
├── assets/
│   ├── majd full logo.png
│   ├── majd full logo_Transparent.png
│   ├── majd_IconOnly_Transparent.png
│   ├── majd_IconOnly (1).png
│   ├── majd-gui-optimized.css
│   └── majd-gui-optimized.js
```

### Step 3: Activate and Configure the Plugin
1. Log in to your WordPress admin dashboard
2. Go to Plugins > Installed Plugins
3. Find "Majd AI Chat Interface" and click "Activate"
4. After activation, click on "Majd AI" in the left sidebar
5. Configure the settings:
   - API Endpoint: `https://api.majd-ai.app/api/chat` (or your custom endpoint)
   - Streaming Endpoint: `https://api.majd-ai.app/api/chat/stream` (or your custom endpoint)
   - Background Color: `#121212` (black)
   - Chat Box Color: `#FF3333` (red)
   - User Text Color: `#000000` (black)
   - AI Text Color: `#AAFF00` (light green)
   - Enable Streaming: Checked
   - Enable Voice Input: Checked
   - Show Reasoning: As preferred
   - Max Messages: 100
6. Click "Save Settings"

### Step 4: Add to WordPress Pages
1. Create a new page or edit an existing one
2. Add a Shortcode block
3. Enter the shortcode: `[majd_chat]`
4. Publish or update the page

### Step 5: Customize Shortcode (Optional)
You can customize the chat interface with additional parameters:
```
[majd_chat height="600px" width="100%" welcome_message="Hello! Welcome to Majd AI. How can I help you today?"]
```

Available parameters:
- `height`: Height of the chat interface (default: "500px")
- `width`: Width of the chat interface (default: "100%")
- `welcome_message`: Custom welcome message
- `force_styles`: Set to "true" to force custom styles (useful for theme conflicts)

## Standalone HTML Deployment

### Step 1: Prepare Web Server Directory
1. Create a directory on your web server for the Majd GUI
2. Create a subdirectory called `assets`

### Step 2: Upload Files
1. Upload all files to the directory:
   - `index.html`
   - `majd-gui.css`
   - `majd-gui.js`
2. Upload all logo files to the `assets` directory

Your directory structure should look like:
```
your-directory/
├── index.html
├── majd-gui.css
├── majd-gui.js
├── assets/
│   ├── majd full logo.png
│   ├── majd full logo_Transparent.png
│   ├── majd_IconOnly_Transparent.png
│   └── majd_IconOnly (1).png
```

### Step 3: Configure API Endpoints
1. Open `index.html` in a text editor
2. Locate the JavaScript initialization section near the bottom
3. Update the API endpoints to match your backend:
   ```javascript
   new MajdGUI({
       containerId: 'majd-container',
       apiEndpoint: 'https://api.majd-ai.app/api/chat', // Update this
       streamingEndpoint: 'https://api.majd-ai.app/api/chat/stream', // Update this
       // other options...
   });
   ```

### Step 4: Test the Implementation
1. Open the page in a web browser
2. Verify that the Majd logo appears correctly in the header and welcome screen
3. Test the chat functionality to ensure it's working properly

## Customization Options

### Changing Colors
The Majd GUI uses CSS variables for easy color customization:

```css
:root {
  /* Brand Colors */
  --majd-cyan: #00E5E5;
  --majd-blue: #4169E1;
  --majd-purple: #6A0DAD;
  
  /* UI Colors */
  --background-color: #121212;
  --chat-box-color: #FF3333;
  --user-text-color: #000000;
  --ai-text-color: #AAFF00;
}
```

You can modify these values in the CSS file to match your preferred color scheme while maintaining the Majd branding.

### Customizing the Welcome Message
You can customize the welcome message in two ways:

1. **WordPress Shortcode**:
   ```
   [majd_chat welcome_message="Your custom welcome message here"]
   ```

2. **JavaScript Initialization**:
   ```javascript
   new MajdGUI({
       // other options...
       welcomeMessage: 'Your custom welcome message here',
   });
   ```

### Adding Custom Features to the Landing Page
The `index.html` file includes a complete landing page with sections for features. You can modify this file to:

1. Add more sections
2. Update feature descriptions
3. Add testimonials or pricing information
4. Include additional calls-to-action

## Troubleshooting

### Logo Not Displaying
1. Verify that the logo files are in the correct directory
2. Check file permissions (should be readable by the web server)
3. Confirm that the file paths in the code match your directory structure
4. Clear browser cache and reload the page

### CSS Styling Issues
1. Make sure the CSS file is properly loaded
2. Check for any CSS conflicts with your WordPress theme
3. Try using the `force_styles="true"` parameter in the shortcode
4. Inspect the elements using browser developer tools to identify styling issues

### API Connection Problems
1. Verify that the API endpoints are correct
2. Check for any CORS issues (the API must allow requests from your domain)
3. Ensure your backend service is running
4. Look for error messages in the browser console

### WordPress Plugin Conflicts
1. Temporarily deactivate other plugins to identify conflicts
2. Check if your theme has any JavaScript that might interfere with the chat interface
3. Try using a default WordPress theme to test if the issue is theme-related

---

For additional support or customization requests, please contact support@majd-ai.app.
