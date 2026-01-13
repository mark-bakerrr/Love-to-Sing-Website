#!/bin/bash

# Audio Chapter Markers - Mac Installation Script
# Run this script on your Mac to install the extension

echo "=========================================="
echo "Audio Chapter Markers Installation"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# CEP Extensions folder (user-level)
CEP_FOLDER="$HOME/Library/Application Support/Adobe/CEP/extensions"

echo "Step 1: Creating CEP extensions folder..."
mkdir -p "$CEP_FOLDER"

if [ -d "$CEP_FOLDER" ]; then
    echo "✓ CEP folder created/verified"
else
    echo "✗ Failed to create CEP folder"
    exit 1
fi

echo ""
echo "Step 2: Copying extension files..."
cp -r "$SCRIPT_DIR" "$CEP_FOLDER/audio-chapter-markers"

if [ -d "$CEP_FOLDER/audio-chapter-markers" ]; then
    echo "✓ Extension files copied successfully"
else
    echo "✗ Failed to copy extension files"
    exit 1
fi

echo ""
echo "Step 3: Enabling debug mode for Premiere Pro..."

# Enable debug mode for all CEP versions
defaults write com.adobe.CSXS.8 PlayerDebugMode 1
defaults write com.adobe.CSXS.9 PlayerDebugMode 1
defaults write com.adobe.CSXS.10 PlayerDebugMode 1
defaults write com.adobe.CSXS.11 PlayerDebugMode 1

echo "✓ Debug mode enabled"

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Restart Adobe Premiere Pro if it's running"
echo "2. Open Premiere Pro"
echo "3. Go to: Window > Extensions > Audio Chapter Markers"
echo ""
echo "Extension installed at:"
echo "$CEP_FOLDER/audio-chapter-markers"
echo ""
echo "If you don't see the extension:"
echo "- Make sure Premiere Pro is completely closed and restarted"
echo "- Check that you're using Premiere Pro CC 2018 or later"
echo "- See README.md for troubleshooting"
echo ""
