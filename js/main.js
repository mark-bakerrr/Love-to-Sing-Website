/**
 * Audio Chapter Markers - Main JavaScript
 */

var csInterface = new CSInterface();

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
  console.log('Audio Chapter Markers Extension Loaded');
  refreshSequenceInfo();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('createMarkersBtn').addEventListener('click', createChapterMarkers);
  document.getElementById('previewAudioBtn').addEventListener('click', previewAudioClips);
  document.getElementById('removeMarkersBtn').addEventListener('click', removeAllMarkers);
  document.getElementById('copyNumberedBtn').addEventListener('click', copyNumberedList);
  document.getElementById('copyTimecodesBtn').addEventListener('click', copyTimecodeList);
  document.getElementById('refreshBtn').addEventListener('click', refreshSequenceInfo);
}

function showStatus(message, type) {
  var statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.className = 'status-message ' + type;

  if (type === 'success' || type === 'info') {
    setTimeout(function() {
      statusEl.style.display = 'none';
    }, 5000);
  }
}

function refreshSequenceInfo() {
  showStatus('Refreshing sequence info...', 'info');

  csInterface.evalScript('getSequenceInfo()', function(result) {
    try {
      var info = JSON.parse(result);

      if (info.error) {
        showStatus(info.error, 'error');
        document.getElementById('sequenceName').textContent = 'N/A';
        document.getElementById('sequenceDuration').textContent = '--:--';
        document.getElementById('audioTracks').textContent = '0';
        document.getElementById('markerCount').textContent = '0';
      } else {
        document.getElementById('sequenceName').textContent = info.name || 'N/A';
        document.getElementById('sequenceDuration').textContent = info.duration || '--:--';
        document.getElementById('audioTracks').textContent = info.audioTracks || '0';
        document.getElementById('markerCount').textContent = info.markers || '0';
        showStatus('Sequence info updated', 'success');
      }
    } catch (e) {
      showStatus('Error parsing sequence info: ' + e.message, 'error');
    }
  });
}

function createChapterMarkers() {
  showStatus('Creating chapter markers...', 'info');

  csInterface.evalScript('createChapterMarkers()', function(result) {
    try {
      var response = JSON.parse(result);

      if (response.error) {
        showStatus(response.error, 'error');
      } else {
        showStatus(response.message + ' (' + response.count + ' markers created)', 'success');
        refreshSequenceInfo();
      }
    } catch (e) {
      showStatus('Error: ' + e.message, 'error');
    }
  });
}

function previewAudioClips() {
  showStatus('Loading audio clips preview...', 'info');

  csInterface.evalScript('getAudioClipsList()', function(result) {
    try {
      var response = JSON.parse(result);

      if (response.error) {
        showStatus(response.error, 'error');
      } else if (response.clips && response.clips.length > 0) {
        var clipList = response.clips.map(function(clip, index) {
          return (index + 1) + '. ' + clip.name + ' (Start: ' + clip.timecode + ')';
        }).join('\n');

        showStatus('Found ' + response.clips.length + ' audio clips:\n' + clipList, 'info');
      } else {
        showStatus('No audio clips found in the current sequence', 'info');
      }
    } catch (e) {
      showStatus('Error: ' + e.message, 'error');
    }
  });
}

function removeAllMarkers() {
  if (!confirm('Are you sure you want to remove all chapter markers from this sequence?')) {
    return;
  }

  showStatus('Removing all markers...', 'info');

  csInterface.evalScript('removeAllMarkers()', function(result) {
    try {
      var response = JSON.parse(result);

      if (response.error) {
        showStatus(response.error, 'error');
      } else {
        showStatus(response.message + ' (' + response.count + ' markers removed)', 'success');
        refreshSequenceInfo();
      }
    } catch (e) {
      showStatus('Error: ' + e.message, 'error');
    }
  });
}

function copyNumberedList() {
  showStatus('Generating numbered list...', 'info');

  csInterface.evalScript('getNumberedMarkerList()', function(result) {
    try {
      var response = JSON.parse(result);

      if (response.error) {
        showStatus(response.error, 'error');
      } else if (response.list) {
        copyToClipboard(response.list);
        showStatus('Numbered list copied to clipboard!', 'success');
      } else {
        showStatus('No markers found to export', 'info');
      }
    } catch (e) {
      showStatus('Error: ' + e.message, 'error');
    }
  });
}

function copyTimecodeList() {
  showStatus('Generating timecode list...', 'info');

  csInterface.evalScript('getTimecodeMarkerList()', function(result) {
    try {
      var response = JSON.parse(result);

      if (response.error) {
        showStatus(response.error, 'error');
      } else if (response.list) {
        copyToClipboard(response.list);
        showStatus('Timecode list copied to clipboard!', 'success');
      } else {
        showStatus('No markers found to export', 'info');
      }
    } catch (e) {
      showStatus('Error: ' + e.message, 'error');
    }
  });
}

function copyToClipboard(text) {
  // Create a temporary textarea element
  var textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
  }

  document.body.removeChild(textarea);
}
