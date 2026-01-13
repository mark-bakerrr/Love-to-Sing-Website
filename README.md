# Audio Chapter Markers for Adobe Premiere Pro

A powerful Adobe Premiere Pro extension that automatically creates chapter markers from audio clip names, making it easy to organize and export your timeline structure.

![Audio Chapter Markers Extension](https://img.shields.io/badge/version-1.0.0-blue.svg)

## Features

- **Auto-Create Chapter Markers**: Automatically generate chapter markers based on audio clip names at their correct timecodes
- **Preview Audio Clips**: View all audio clips in your sequence before creating markers
- **Export Options**:
  - Copy as numbered list (1. Song Name, 2. Song Name, etc.)
  - Copy with timecodes (00:00:00 [Song Name])
- **Batch Remove**: Remove all chapter markers with one click
- **Real-time Updates**: Refresh sequence information instantly
- **Cross-Platform**: Works on both macOS and Windows

## Requirements

- Adobe Premiere Pro CC 2018 or later (version 14.0+)
- macOS 10.12+ or Windows 10+

## Installation

### Option 1: Manual Installation (Recommended)

#### For macOS:

1. Close Adobe Premiere Pro if it's running
2. Navigate to the CEP extensions folder:
   ```
   /Library/Application Support/Adobe/CEP/extensions/
   ```
   If the folder doesn't exist, create it manually
3. Copy the entire `audio-chapter-markers` folder to this location
4. The full path should be:
   ```
   /Library/Application Support/Adobe/CEP/extensions/audio-chapter-markers/
   ```
5. Enable debugging mode (first-time setup):
   - Open Terminal
   - Run: `defaults write com.adobe.CSXS.10 PlayerDebugMode 1`
   - For CC 2019: `defaults write com.adobe.CSXS.9 PlayerDebugMode 1`
   - For CC 2018: `defaults write com.adobe.CSXS.8 PlayerDebugMode 1`
6. Launch Adobe Premiere Pro
7. Go to **Window > Extensions > Audio Chapter Markers**

#### For Windows:

1. Close Adobe Premiere Pro if it's running
2. Navigate to the CEP extensions folder:
   ```
   C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\
   ```
   If the folder doesn't exist, create it manually
3. Copy the entire `audio-chapter-markers` folder to this location
4. The full path should be:
   ```
   C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\audio-chapter-markers\
   ```
5. Enable debugging mode (first-time setup):
   - Open Registry Editor (regedit.exe)
   - Navigate to: `HKEY_CURRENT_USER\Software\Adobe\CSXS.10`
   - If the key doesn't exist, create it
   - Create a new String Value named `PlayerDebugMode` with value `1`
   - For CC 2019: Use `CSXS.9`, for CC 2018: Use `CSXS.8`
6. Launch Adobe Premiere Pro
7. Go to **Window > Extensions > Audio Chapter Markers**

### Option 2: Developer Installation

If you want to develop or modify the extension:

1. Clone this repository:
   ```bash
   git clone https://github.com/mark-bakerrr/lovetosing.git
   cd lovetosing
   ```

2. Create a symbolic link to the extensions folder:

   **macOS:**
   ```bash
   ln -s "$(pwd)" "/Library/Application Support/Adobe/CEP/extensions/audio-chapter-markers"
   ```

   **Windows (Command Prompt as Administrator):**
   ```cmd
   mklink /D "C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\audio-chapter-markers" "%CD%"
   ```

3. Enable debug mode as described above
4. Restart Premiere Pro

## Usage

### Creating Chapter Markers

1. Open your sequence in Premiere Pro
2. Open the extension: **Window > Extensions > Audio Chapter Markers**
3. Click **REFRESH SEQUENCE INFO** to load sequence details
4. Click **CREATE CHAPTER MARKERS** to automatically create markers from audio clip names
5. Markers will be created at the start timecode of each audio clip

### Previewing Audio Clips

- Click **PREVIEW AUDIO CLIPS** to see a list of all audio clips in your sequence with their timecodes

### Exporting Marker Lists

**Numbered List:**
- Click **COPY AS NUMBERED LIST**
- Format: `1. Song Name`
- Paste into any text editor or document

**Timecode List:**
- Click **COPY WITH TIMECODES**
- Format: `00:00:00 [Song Name]`
- Perfect for YouTube descriptions and video platforms

### Removing Markers

- Click **REMOVE ALL MARKERS** to delete all chapter markers from the current sequence
- You'll be prompted to confirm before deletion

### Customizing Marker Colors

By default, markers are created as chapter markers. To change the color:
1. Right-click any marker in the Premiere Pro timeline
2. Select a color from the context menu (e.g., red, blue, green)

## Troubleshooting

### Extension doesn't appear in Window > Extensions menu

1. Verify the extension folder is in the correct location
2. Check that debug mode is enabled (see installation steps)
3. Make sure Premiere Pro has been completely restarted
4. Check that the `CSXS` version matches your Premiere Pro version:
   - CC 2022+: CSXS.10
   - CC 2020-2021: CSXS.9
   - CC 2018-2019: CSXS.8

### "No active sequence found" error

- Make sure you have an active sequence open in Premiere Pro
- Click on the sequence timeline to ensure it's active

### Markers not creating

- Verify you have audio clips in your sequence
- Check that the audio clips have names (not just default names)
- Try refreshing the sequence info first

### Permission errors on macOS

If you get permission errors, you may need to use `sudo`:
```bash
sudo cp -r audio-chapter-markers "/Library/Application Support/Adobe/CEP/extensions/"
```

### Extension shows blank panel

1. Check browser console for errors:
   - Right-click in the panel
   - Select "Developer Tools" or "Inspect"
2. Verify all files are in the correct locations
3. Check that `CSInterface.js` is present in the `js/` folder

## File Structure

```
audio-chapter-markers/
├── CSXS/
│   └── manifest.xml          # Extension manifest
├── css/
│   └── style.css             # UI styling
├── js/
│   ├── CSInterface.js        # Adobe CEP interface library
│   └── main.js               # Client-side JavaScript
├── jsx/
│   └── main.jsx              # ExtendScript (Premiere Pro API)
├── index.html                # Main UI
├── .debug                    # Debug configuration
├── package.json              # Project metadata
└── README.md                 # This file
```

## Development

To modify this extension:

1. Edit files in the appropriate folders:
   - UI changes: `index.html`, `css/style.css`
   - Client logic: `js/main.js`
   - Premiere Pro API: `jsx/main.jsx`

2. Refresh the extension in Premiere Pro:
   - Close and reopen the extension panel
   - Or restart Premiere Pro

3. Debug using Chrome DevTools:
   - Right-click in the extension panel
   - Select "Developer Tools"
   - View console logs and errors

## Version History

### v1.0.0 (2026-01-13)
- Initial release
- Auto-create chapter markers from audio clips
- Export numbered and timecode lists
- Preview audio clips
- Remove all markers functionality
- Cross-platform support (Mac & Windows)

## License

MIT License - feel free to modify and distribute

## Support

For issues, questions, or feature requests, please open an issue on the GitHub repository.

## Credits

Created with Claude Code
Built for Adobe Premiere Pro using CEP (Common Extensibility Platform)

---

**Note**: This extension is not officially affiliated with Adobe Systems Incorporated.
