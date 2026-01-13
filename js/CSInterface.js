/**
 * CSInterface - v10.0.0
 */

function CSInterface() {}

CSInterface.prototype.evalScript = function(script, callback) {
  if (callback === null || callback === undefined) {
    callback = function(result) {};
  }
  window.__adobe_cep__.evalScript(script, callback);
};

CSInterface.prototype.getSystemPath = function(pathType) {
  var path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
  var OSVersion = this.getOSInformation();
  if (OSVersion.indexOf("Windows") >= 0) {
    path = path.replace("file:///", "");
  } else if (OSVersion.indexOf("Mac") >= 0) {
    path = path.replace("file://", "");
  }
  return path;
};

CSInterface.prototype.getOSInformation = function() {
  var userAgent = navigator.userAgent;
  if (navigator.platform == "Win32" || navigator.platform == "Windows") {
    return "Windows" + this.getWindowsVersion(userAgent);
  } else if (navigator.platform == "MacIntel" || navigator.platform == "Macintosh") {
    return "Mac" + this.getMacVersion(userAgent);
  }
  return "Unknown";
};

CSInterface.prototype.getWindowsVersion = function(userAgent) {
  if (userAgent.indexOf("Windows NT 10") >= 0) {
    return "10";
  } else if (userAgent.indexOf("Windows NT 6.3") >= 0) {
    return "8.1";
  } else if (userAgent.indexOf("Windows NT 6.2") >= 0) {
    return "8";
  } else if (userAgent.indexOf("Windows NT 6.1") >= 0) {
    return "7";
  }
  return "Unknown";
};

CSInterface.prototype.getMacVersion = function(userAgent) {
  var verStr = "Unknown";
  var match = /Mac OS X (\d+)\.(\d+)/.exec(userAgent);
  if (match) {
    verStr = match[1] + "." + match[2];
  }
  return verStr;
};

CSInterface.prototype.addEventListener = function(type, listener, obj) {
  window.addEventListener(type, listener, obj);
};

CSInterface.prototype.removeEventListener = function(type, listener, obj) {
  window.removeEventListener(type, listener, obj);
};

CSInterface.prototype.dispatchEvent = function(event) {
  if (typeof event.data == "object") {
    event.data = JSON.stringify(event.data);
  }
  window.__adobe_cep__.dispatchEvent(event);
};

// System Path types
CSInterface.SystemPath = {
  USER_DATA: "userData",
  COMMON_FILES: "commonFiles",
  MY_DOCUMENTS: "myDocuments",
  APPLICATION: "application",
  EXTENSION: "extension",
  HOST_APPLICATION: "hostApplication"
};

if (!String.prototype.trim) {
  String.prototype.trim = function() {
    return this.replace(/^\s+|\s+$/g, '');
  };
}
