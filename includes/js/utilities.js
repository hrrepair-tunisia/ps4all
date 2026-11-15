// Shared functions used by both index.html and exploit.html.

function sleep(ms) {
    ms = ms || 0;
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// Taken from Feyzee61's ps4jb
// Pass isModule=true only for ES module scripts (.mjs).
function getScript(source, isModule, devMode) {
    return new Promise(function (resolve, reject) {
        var gs = document.createElement('script');
        gs.src = source;
        gs.type = isModule ? 'module' : 'text/javascript';
        gs.async = false;
        gs.onload = function () { resolve(); };
        gs.onerror = function () { reject(new Error('Script load failed: ' + source)); };
        document.body.appendChild(gs);
        if (devMode) log('[Debug] Script loaded as ' + gs.type + '; ' + source, "grey");
    });
}

// Taken from Feyzee61's ps4jb
// Loads a script and waits for it to signal readiness via window.script_loaded.
// The BadHoist exploit sets window.script_loaded = 1 when it is ready.
function loadScript(script_js, isModule, devMode) {
    window.script_loaded = 0;
    return getScript(script_js, isModule, devMode).then(function () {
        return new Promise(function (resolve) {
            function waitForLoad() {
                if (window.script_loaded >= 1) {
                    resolve();
                } else {
                    setTimeout(waitForLoad, 50);
                }
            }
            waitForLoad();
        });
    });
}

function isHttps() {
    return window.location.protocol === 'https:';
}

// HR Repair: mirror the real exploit log on screen one without moving or cloning
// the original status panel. This keeps the existing exploit code and page two intact.
function syncHRInlineProgress() {
    var sourceConsole = null;
    if (typeof ui !== 'undefined' && ui.consoleElement) {
        sourceConsole = ui.consoleElement;
    } else {
        sourceConsole = document.getElementById('console');
    }
    var mirrorConsole = document.getElementById('hr-inline-progress-console');
    if (!sourceConsole || !mirrorConsole) return;
    mirrorConsole.innerHTML = sourceConsole.innerHTML;
    mirrorConsole.scrollTop = mirrorConsole.scrollHeight;
}

function showHRInlineProgress() {
    var screen = (typeof ui !== 'undefined' && ui.initialScreen)
        ? ui.initialScreen
        : document.getElementById('initial-screen');
    if (!screen) return false;

    var host = document.getElementById('hr-inline-progress-host');
    if (!host) {
        host = document.createElement('section');
        host.id = 'hr-inline-progress-host';

        var headingRow = document.createElement('div');
        headingRow.className = 'hr-inline-progress-heading';

        var heading = document.createElement('h2');
        heading.id = 'hr-inline-progress-title';
        var originalHeading = document.getElementById('state');
        heading.textContent = originalHeading ? originalHeading.textContent : 'Exploit status';

        var liveLabel = document.createElement('span');
        liveLabel.className = 'hr-inline-progress-live';
        liveLabel.textContent = 'LIVE';
        headingRow.appendChild(heading);
        headingRow.appendChild(liveLabel);

        var consoleBox = document.createElement('div');
        consoleBox.id = 'hr-inline-progress-console-box';
        consoleBox.dir = 'ltr';

        var mirror = document.createElement('pre');
        mirror.id = 'hr-inline-progress-console';
        mirror.textContent = 'Preparing exploit...';
        consoleBox.appendChild(mirror);
        host.appendChild(headingRow);
        host.appendChild(consoleBox);

        var chooseBox = document.getElementById('choosejb-initial');
        if (chooseBox && chooseBox.parentNode === screen && chooseBox.nextSibling) {
            screen.insertBefore(host, chooseBox.nextSibling);
        } else if (chooseBox && chooseBox.parentNode === screen) {
            screen.appendChild(host);
        } else {
            screen.appendChild(host);
        }
    }

    screen.classList.remove('hidden');
    screen.classList.add('hr-progress-active');
    screen.style.removeProperty('display');

    // Hide only the start controls; keep the HR Repair header and first page visible.
    var idsToHide = [
        'pslogo', 'click-to-start-text', 'stopAutoJb', 'PS4FW',
        'choosejb-initial', 'scrollDown'
    ];
    for (var i = 0; i < idsToHide.length; i++) {
        var element = document.getElementById(idsToHide[i]);
        if (element) {
            element.classList.add('hidden');
            element.style.setProperty('display', 'none', 'important');
        }
    }

    var source = (typeof ui !== 'undefined' && ui.consoleElement)
        ? ui.consoleElement
        : document.getElementById('console');
    var target = document.getElementById('hr-inline-progress-console');
    if (source && target) {
        target.innerHTML = source.innerHTML || '<span>Preparing exploit...</span>';
        target.scrollTop = target.scrollHeight;
    }

    // Keep the first screen in view when Start was triggered from a different section.
    if (typeof ui !== 'undefined' && ui.mainContainer) {
        ui.mainContainer.scrollTop = 0;
    }
    if (typeof lastScrollY !== 'undefined') lastScrollY = 0;
    if (typeof lastSection !== 'undefined') lastSection = 'initial';
    return true;
}

// Works in both index.html and exploit.html
function log(message, color, consoleEl) {
    var consoleEl = consoleEl ? consoleEl : ui.consoleElement;
    var consoleEl = (typeof ui !== 'undefined' && ui.consoleElement)
        ? ui.consoleElement
        : document.getElementById('console');

    if (typeof user !== 'undefined' && user.clearLog && consoleEl) {
        consoleEl.textContent = '';
        user.clearLog = false;
    }
    if (!consoleEl) return;

    var span = document.createElement('span');
    // break text into a new line to keep it visible
    span.style.whiteSpace = "pre-wrap";
    span.textContent = message + '\n';
    if (color) span.style.color = color;
    consoleEl.appendChild(span);
    if (typeof syncHRInlineProgress === 'function') syncHRInlineProgress();
}

function getReloadAfterJbValue() {
    return storage.getBoolean('reloadAfterJb', false);
}

/**
 * Increment jailbreak attempt/success counters in storage and update the UI.
 * @param {boolean} attempt   - true when a new jailbreak attempt starts.
 * @param {boolean} isSuccess - true when the jailbreak succeeds.
 * Passing both false refreshes the UI display without changing stored counts.
 */
function updateJbStats(attempt, isSuccess, revert) {
    var total = storage.getNumber('jbTotal', 0);
    var success = storage.getNumber('jbSuccess', 0);

    if (revert) {
        total--;
        storage.set('jbTotal', total);
        return;
    }

    if (attempt) {
        total++;
        storage.set('jbTotal', total);
    }
    if (isSuccess) {
        success++;
        storage.set('jbSuccess', success);
    }

    if (typeof ui !== 'undefined' && ui.successRateText && window.lang) {
        var rate = total > 0 ? ((success / total) * 100).toFixed(0) : '0';
        var displayRate = total > 0 ? rate + '%' : '-';
        ui.successRateText.textContent =
            (window.lang.successRate || 'Success Rate: ') + displayRate + ' (' + success + '/' + total + ')';
    }
}

// Called by exploit implementations after a successful jailbreak.
function jailbreakSuccess(statusMessage) {
    var isBinLoader = storage.session.getBoolean('binloader', false);
    if (storage.session.getBoolean('jailbreakNow', true)) {
        storage.session.remove('jailbreakNow');
    }
    storage.session.remove('autoJbRetry');
    storage.session.remove('payload_path');
    storage.session.remove('binloader');

    updateJbStats(0, 1);

    if (getReloadAfterJbValue() && !isBinLoader) {
        setTimeout(function () { window.location.href = mainPage; }, 5000);
    }

    if (typeof ui !== 'undefined' && ui.exploitState) {
        ui.exploitState.textContent = statusMessage
            || (window.lang && window.lang.jailbreakSuccess)
            || 'Jailbreak successful!';
    } else {
        var stateEl = document.getElementById('state');
        if (stateEl && statusMessage) {
            stateEl.textContent = statusMessage;
        }
    }
}

function isLocalIP(ip) {
    if (ip === 'localhost' || ip === '::1' || ip === '::ffff:127.0.0.1') {
        return true;
    }
    return /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);
}

/**
 * Sets the .hidden class to an element.
 * @param {string} id   - the element ID to hide/show
 * @param {boolean} show - true to show, false to hide. otherwise toggle.
 */
function toggleVisibility(id, show) {
    var el = document.getElementById(id);
    if (!el) return;

    if (show === undefined) {
        el.classList.toggle('hidden');
    } else if (show) {
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}