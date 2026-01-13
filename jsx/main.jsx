/**
 * Audio Chapter Markers - ExtendScript (JSX)
 * Premiere Pro Integration
 */

// Utility function to format timecode
function formatTimecode(ticks) {
    if (!app.project.activeSequence) {
        return "00:00:00";
    }

    var frameRate = app.project.activeSequence.framerate;
    var totalSeconds = ticks / 254016000000;

    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = Math.floor(totalSeconds % 60);

    function pad(num) {
        return (num < 10 ? "0" : "") + num;
    }

    return pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
}

// Get current sequence information
function getSequenceInfo() {
    try {
        if (!app.project.activeSequence) {
            return JSON.stringify({
                error: "No active sequence found. Please open a sequence."
            });
        }

        var sequence = app.project.activeSequence;
        var audioTracks = sequence.audioTracks.numTracks;
        var markers = sequence.markers.numMarkers;
        var duration = formatTimecode(sequence.end);
        var name = sequence.name;

        return JSON.stringify({
            name: name,
            duration: duration,
            audioTracks: audioTracks,
            markers: markers
        });
    } catch (e) {
        return JSON.stringify({
            error: "Error getting sequence info: " + e.toString()
        });
    }
}

// Get all audio clips in the sequence
function getAudioClips() {
    var clips = [];

    if (!app.project.activeSequence) {
        return clips;
    }

    var sequence = app.project.activeSequence;
    var audioTracks = sequence.audioTracks;

    for (var i = 0; i < audioTracks.numTracks; i++) {
        var track = audioTracks[i];
        var trackClips = track.clips;

        for (var j = 0; j < trackClips.numItems; j++) {
            var clip = trackClips[j];

            clips.push({
                name: clip.name,
                start: clip.start.ticks,
                end: clip.end.ticks,
                timecode: formatTimecode(clip.start.ticks)
            });
        }
    }

    // Sort clips by start time
    clips.sort(function(a, b) {
        return a.start - b.start;
    });

    return clips;
}

// Get audio clips list for preview
function getAudioClipsList() {
    try {
        var clips = getAudioClips();

        if (clips.length === 0) {
            return JSON.stringify({
                error: "No audio clips found in the active sequence."
            });
        }

        return JSON.stringify({
            clips: clips,
            count: clips.length
        });
    } catch (e) {
        return JSON.stringify({
            error: "Error getting audio clips: " + e.toString()
        });
    }
}

// Create chapter markers from audio clips
function createChapterMarkers() {
    try {
        if (!app.project.activeSequence) {
            return JSON.stringify({
                error: "No active sequence found. Please open a sequence."
            });
        }

        var sequence = app.project.activeSequence;
        var clips = getAudioClips();

        if (clips.length === 0) {
            return JSON.stringify({
                error: "No audio clips found in the sequence."
            });
        }

        var markersCreated = 0;
        var existingMarkers = {};

        // Track existing markers to avoid duplicates
        for (var i = 0; i < sequence.markers.numMarkers; i++) {
            var marker = sequence.markers[i];
            existingMarkers[marker.start.ticks] = true;
        }

        // Create markers for each audio clip
        for (var i = 0; i < clips.length; i++) {
            var clip = clips[i];

            // Skip if marker already exists at this position
            if (existingMarkers[clip.start]) {
                continue;
            }

            var marker = sequence.markers.createMarker(clip.start);
            marker.name = clip.name;
            marker.comments = "Audio Chapter: " + clip.name;
            marker.type = "Chapter"; // Set as chapter marker

            markersCreated++;
        }

        return JSON.stringify({
            message: "Chapter markers created successfully",
            count: markersCreated
        });
    } catch (e) {
        return JSON.stringify({
            error: "Error creating markers: " + e.toString()
        });
    }
}

// Remove all markers from the sequence
function removeAllMarkers() {
    try {
        if (!app.project.activeSequence) {
            return JSON.stringify({
                error: "No active sequence found."
            });
        }

        var sequence = app.project.activeSequence;
        var markerCount = sequence.markers.numMarkers;

        if (markerCount === 0) {
            return JSON.stringify({
                message: "No markers to remove",
                count: 0
            });
        }

        // Delete all markers (delete from end to avoid index issues)
        for (var i = markerCount - 1; i >= 0; i--) {
            sequence.markers.deleteMarker(i);
        }

        return JSON.stringify({
            message: "All markers removed successfully",
            count: markerCount
        });
    } catch (e) {
        return JSON.stringify({
            error: "Error removing markers: " + e.toString()
        });
    }
}

// Get numbered list of markers
function getNumberedMarkerList() {
    try {
        if (!app.project.activeSequence) {
            return JSON.stringify({
                error: "No active sequence found."
            });
        }

        var sequence = app.project.activeSequence;
        var markers = [];

        for (var i = 0; i < sequence.markers.numMarkers; i++) {
            var marker = sequence.markers[i];
            markers.push({
                name: marker.name,
                start: marker.start.ticks
            });
        }

        // Sort by start time
        markers.sort(function(a, b) {
            return a.start - b.start;
        });

        if (markers.length === 0) {
            return JSON.stringify({
                error: "No markers found in the sequence."
            });
        }

        // Create numbered list
        var list = "";
        for (var i = 0; i < markers.length; i++) {
            list += (i + 1) + ". " + markers[i].name;
            if (i < markers.length - 1) {
                list += "\n";
            }
        }

        return JSON.stringify({
            list: list,
            count: markers.length
        });
    } catch (e) {
        return JSON.stringify({
            error: "Error generating numbered list: " + e.toString()
        });
    }
}

// Get timecode list of markers
function getTimecodeMarkerList() {
    try {
        if (!app.project.activeSequence) {
            return JSON.stringify({
                error: "No active sequence found."
            });
        }

        var sequence = app.project.activeSequence;
        var markers = [];

        for (var i = 0; i < sequence.markers.numMarkers; i++) {
            var marker = sequence.markers[i];
            markers.push({
                name: marker.name,
                start: marker.start.ticks,
                timecode: formatTimecode(marker.start.ticks)
            });
        }

        // Sort by start time
        markers.sort(function(a, b) {
            return a.start - b.start;
        });

        if (markers.length === 0) {
            return JSON.stringify({
                error: "No markers found in the sequence."
            });
        }

        // Create timecode list
        var list = "";
        for (var i = 0; i < markers.length; i++) {
            list += markers[i].timecode + " [" + markers[i].name + "]";
            if (i < markers.length - 1) {
                list += "\n";
            }
        }

        return JSON.stringify({
            list: list,
            count: markers.length
        });
    } catch (e) {
        return JSON.stringify({
            error: "Error generating timecode list: " + e.toString()
        });
    }
}

// Auto-update markers when sequence changes
// This can be called manually or on a timer
function autoUpdateMarkers() {
    try {
        if (!app.project.activeSequence) {
            return JSON.stringify({
                error: "No active sequence found."
            });
        }

        var sequence = app.project.activeSequence;
        var clips = getAudioClips();
        var existingMarkers = [];

        // Get all existing marker positions and names
        for (var i = 0; i < sequence.markers.numMarkers; i++) {
            var marker = sequence.markers[i];
            existingMarkers.push({
                start: marker.start.ticks,
                name: marker.name,
                index: i
            });
        }

        var clipPositions = {};
        for (var i = 0; i < clips.length; i++) {
            clipPositions[clips[i].start] = clips[i].name;
        }

        var markersRemoved = 0;
        var markersCreated = 0;

        // Remove markers that don't have corresponding audio clips
        for (var i = existingMarkers.length - 1; i >= 0; i--) {
            var marker = existingMarkers[i];
            if (!clipPositions[marker.start]) {
                sequence.markers.deleteMarker(marker.index);
                markersRemoved++;
            }
        }

        // Refresh existing markers after deletion
        var currentMarkers = {};
        for (var i = 0; i < sequence.markers.numMarkers; i++) {
            currentMarkers[sequence.markers[i].start.ticks] = true;
        }

        // Add markers for new clips
        for (var i = 0; i < clips.length; i++) {
            var clip = clips[i];
            if (!currentMarkers[clip.start]) {
                var marker = sequence.markers.createMarker(clip.start);
                marker.name = clip.name;
                marker.comments = "Audio Chapter: " + clip.name;
                marker.type = "Chapter";
                markersCreated++;
            }
        }

        return JSON.stringify({
            message: "Markers updated",
            created: markersCreated,
            removed: markersRemoved
        });
    } catch (e) {
        return JSON.stringify({
            error: "Error auto-updating markers: " + e.toString()
        });
    }
}
