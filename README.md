# Smart Time Converter

A Chrome extension that automatically detects time strings on pages (e.g., "9 PM EST"), underlines them to indicate they are convertible, and converts selected times to your local or preferred timezone in a bubble.

## Features
- **Auto-detection**: Automatically detects your browser's local timezone.
- **All countries/regions**: Timezone picker includes all browser-supported IANA regions/countries.
- **Customizable**: Choose a specific target timezone from the extension options.
- **Dark mode menu**: Toggle dark mode in the settings popup.
- **Inline hints**: Automatically underlines detected time strings so users can spot convertible times instantly.
- **Toggle control**: Enable or disable automatic inline underlining from the settings menu.
- **Non-intrusive**: Shows a small, elegant bubble when a valid time string is selected.
- **Debounced**: Optimized performance to prevent lag while selecting text and scanning DOM changes.

## Installation Guide

Since this extension is not yet published on the Chrome Web Store, you can install it manually as an "Unpacked Extension".

1. **Download or Clone** this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** by toggling the switch in the top right corner.
4. Click the **Load unpacked** button that appears in the top left.
5. Select the folder containing the extension files (the folder with `manifest.json`).
6. The extension is now installed! You should see its icon in your browser toolbar.

## Usage
1. Visit any page and look for underlined time strings (e.g., `14:30 PST` or `9 PM EST`).
2. Highlight one of those times to show the conversion bubble in your target timezone.
3. Click the extension icon to change timezone or toggle automatic underlining on/off.