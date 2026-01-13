# Mac Installation - Step by Step

## 🚀 Quick Install (Automatic)

1. **Download this entire folder** to your Mac
2. **Open Terminal** (Applications > Utilities > Terminal)
3. **Navigate to the folder**:
   ```bash
   cd /path/to/audio-chapter-markers
   ```
4. **Run the installation script**:
   ```bash
   ./install-mac.sh
   ```
5. **Restart Premiere Pro** and go to **Window > Extensions > Audio Chapter Markers**

---

## 📋 Manual Install (Step by Step)

If the automatic script doesn't work, follow these manual steps:

### Step 1: Download Extension Files
Download this entire `audio-chapter-markers` folder to your Mac

### Step 2: Open Finder and Navigate to Extensions Folder

1. Open **Finder**
2. Press **Cmd + Shift + G** (Go to Folder)
3. Type or paste this path:
   ```
   ~/Library/Application Support/Adobe/CEP/extensions
   ```
4. Click **Go**

**If the folder doesn't exist:**
- Open **Terminal** (Applications > Utilities > Terminal)
- Run: `mkdir -p "$HOME/Library/Application Support/Adobe/CEP/extensions"`
- Then go back to Step 2

### Step 3: Copy Extension Folder

1. Drag the entire `audio-chapter-markers` folder into the `extensions` folder
2. The final path should be:
   ```
   ~/Library/Application Support/Adobe/CEP/extensions/audio-chapter-markers/
   ```

### Step 4: Enable Debug Mode

1. Open **Terminal** (Applications > Utilities > Terminal)
2. Copy and paste these commands one by one:

   ```bash
   defaults write com.adobe.CSXS.11 PlayerDebugMode 1
   defaults write com.adobe.CSXS.10 PlayerDebugMode 1
   defaults write com.adobe.CSXS.9 PlayerDebugMode 1
   defaults write com.adobe.CSXS.8 PlayerDebugMode 1
   ```

3. Press **Enter** after each line

### Step 5: Restart Premiere Pro

1. **Completely quit** Adobe Premiere Pro (Cmd + Q)
2. **Relaunch** Adobe Premiere Pro
3. Go to **Window > Extensions > Audio Chapter Markers**

---

## ✅ Verify Installation

You should see:
- "Audio Chapter Markers" appears in the **Window > Extensions** menu
- The extension panel opens showing the dark interface
- When you open a sequence, it displays sequence info

---

## 🔧 Troubleshooting

### Extension doesn't appear in Window > Extensions

**Check the installation path:**
1. Open Terminal
2. Run: `ls -la "$HOME/Library/Application Support/Adobe/CEP/extensions/audio-chapter-markers"`
3. You should see files like `index.html`, `CSXS`, `js`, etc.

**Verify debug mode is enabled:**
1. Open Terminal
2. Run: `defaults read com.adobe.CSXS.11 PlayerDebugMode`
3. Should return `1` (if you get an error, debug mode isn't set)

**Check Premiere Pro version:**
- You need **Premiere Pro CC 2018 or later**
- Go to **Premiere Pro > About Premiere Pro** to check

**Try the system-level installation:**

If user-level doesn't work, try installing system-wide:

1. Open Terminal
2. Run:
   ```bash
   sudo mkdir -p "/Library/Application Support/Adobe/CEP/extensions"
   sudo cp -r ~/Desktop/audio-chapter-markers "/Library/Application Support/Adobe/CEP/extensions/"
   ```
3. Enter your Mac password when prompted
4. Restart Premiere Pro

### "No active sequence found" error

- Make sure you have a sequence open in Premiere Pro
- Click on the sequence timeline to make it active
- Click **REFRESH SEQUENCE INFO** in the extension

### Panel shows blank/white screen

1. Right-click in the extension panel
2. Select **Reload Extension** or **Developer Tools**
3. Check the Console tab for any error messages

### Still not working?

1. Check that all files are in place:
   - CSXS/manifest.xml
   - index.html
   - js/main.js
   - jsx/main.jsx

2. Make sure you completely quit and restart Premiere Pro

3. Try removing and reinstalling:
   ```bash
   rm -rf "$HOME/Library/Application Support/Adobe/CEP/extensions/audio-chapter-markers"
   ```
   Then start over from Step 1

---

## 📞 Need Help?

- See the main **README.md** for full documentation
- Check **INSTALL.md** for additional installation notes
- Open an issue on the GitHub repository

---

## 🎉 Quick Start After Installation

1. Open a sequence with audio clips in Premiere Pro
2. Open the extension: **Window > Extensions > Audio Chapter Markers**
3. Click **CREATE CHAPTER MARKERS** to auto-generate markers
4. Click **COPY AS NUMBERED LIST** or **COPY WITH TIMECODES** to export
5. Use **REMOVE ALL MARKERS** to clear when needed

That's it! Enjoy creating audio chapter markers! 🎵
