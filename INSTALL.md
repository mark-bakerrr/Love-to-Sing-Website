# Quick Installation Guide

## macOS Installation

### Step 1: Copy Extension Files

```bash
sudo cp -r /path/to/audio-chapter-markers "/Library/Application Support/Adobe/CEP/extensions/"
```

Or manually:
1. Open Finder
2. Press `Cmd + Shift + G`
3. Enter: `/Library/Application Support/Adobe/CEP/extensions/`
4. If folder doesn't exist, create it
5. Copy the `audio-chapter-markers` folder here

### Step 2: Enable Debug Mode

Open Terminal and run:

```bash
# For Premiere Pro CC 2022+
defaults write com.adobe.CSXS.10 PlayerDebugMode 1

# For Premiere Pro CC 2020-2021
defaults write com.adobe.CSXS.9 PlayerDebugMode 1

# For Premiere Pro CC 2018-2019
defaults write com.adobe.CSXS.8 PlayerDebugMode 1
```

### Step 3: Launch Extension

1. Restart Adobe Premiere Pro
2. Go to **Window > Extensions > Audio Chapter Markers**

---

## Windows Installation

### Step 1: Copy Extension Files

1. Navigate to: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\`
2. If the folder doesn't exist, create it
3. Copy the `audio-chapter-markers` folder here

### Step 2: Enable Debug Mode

1. Press `Win + R`, type `regedit`, press Enter
2. Navigate to: `HKEY_CURRENT_USER\Software\Adobe\CSXS.10`
3. If the key doesn't exist, right-click `Adobe` > New > Key > name it `CSXS.10`
4. Right-click in the right panel > New > String Value
5. Name it `PlayerDebugMode`, set value to `1`

**For older versions:**
- CC 2020-2021: Use `CSXS.9`
- CC 2018-2019: Use `CSXS.8`

### Step 3: Launch Extension

1. Restart Adobe Premiere Pro
2. Go to **Window > Extensions > Audio Chapter Markers**

---

## Verify Installation

After installation, you should see:
- Extension appears in **Window > Extensions** menu
- Panel opens showing "Audio Chapter Markers" interface
- Sequence info displays when you have an active sequence open

---

## Quick Start

1. Open a sequence with audio clips
2. Click **CREATE CHAPTER MARKERS**
3. Click **COPY AS NUMBERED LIST** or **COPY WITH TIMECODES** to export
4. Use **REMOVE ALL MARKERS** to clear markers when needed

---

## Troubleshooting

**Extension doesn't appear?**
- Verify files are in: `/Library/Application Support/Adobe/CEP/extensions/audio-chapter-markers/` (Mac) or `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\audio-chapter-markers\` (Windows)
- Check debug mode is enabled
- Restart Premiere Pro completely

**Permission denied on Mac?**
- Use `sudo` in the terminal command
- Or manually copy with administrator privileges

**Registry access denied on Windows?**
- Run Registry Editor as Administrator
- Right-click > "Run as administrator"

**Still not working?**
- Check your Premiere Pro version
- Ensure CSXS version matches (10 for 2022+, 9 for 2020-2021, 8 for 2018-2019)
- See full README.md for detailed troubleshooting
