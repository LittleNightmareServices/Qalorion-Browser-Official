const { ipcRenderer } = require('electron');

// --- Window Controls ---
document.getElementById('minimize-btn').addEventListener('click', () => {
    ipcRenderer.send('window-minimize');
});
document.getElementById('maximize-btn').addEventListener('click', () => {
    ipcRenderer.send('window-maximize');
});
document.getElementById('close-btn').addEventListener('click', () => {
    ipcRenderer.send('window-close');
});

// --- Browser Logic ---
const tabBar = document.getElementById('tab-bar');
const webviewContainer = document.getElementById('webview-container');
const urlInput = document.getElementById('url-input');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const goBtn = document.getElementById('go-btn');
const newTabBtn = document.getElementById('new-tab-btn');

let tabs = [];
let activeTabId = null;
let tabCounter = 0;

function createTab(url = 'https://www.google.com') {
    const tabId = `tab-${tabCounter++}`;
    
    // Create Tab UI
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.id = `ui-${tabId}`;
    tabEl.innerHTML = `
        <span class="tab-title">New Tab</span>
        <button class="tab-close"><i class="fa-solid fa-xmark"></i></button>
    `;
    
    // Create Webview
    const webview = document.createElement('webview');
    webview.id = tabId;
    webview.src = url;
    webview.setAttribute('allowpopups', '');
    
    // Insert Elements
    tabBar.insertBefore(tabEl, newTabBtn);
    webviewContainer.appendChild(webview);
    
    const tabObj = { id: tabId, ui: tabEl, webview: webview };
    tabs.push(tabObj);
    
    // Tab Event Listeners
    tabEl.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-close')) {
            activateTab(tabId);
        }
    });
    
    tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tabId);
    });
    
    // Webview Event Listeners
    webview.addEventListener('did-start-loading', () => {
        if (activeTabId === tabId) {
            reloadBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        }
    });
    
    webview.addEventListener('did-stop-loading', () => {
        if (activeTabId === tabId) {
            reloadBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
            urlInput.value = webview.getURL();
        }
    });
    
    webview.addEventListener('page-title-updated', (e) => {
        tabEl.querySelector('.tab-title').textContent = e.title;
    });

    webview.addEventListener('did-navigate', (e) => {
        if (activeTabId === tabId) {
            urlInput.value = e.url;
        }
    });

    // Fix: Links opening in new program window
    webview.addEventListener('new-window', (e) => {
        createTab(e.url);
    });
    
    activateTab(tabId);
}

// IPC from main process for new windows opened via window.open
ipcRenderer.on('open-new-tab', (e, url) => {
    createTab(url);
});

function activateTab(tabId) {
    activeTabId = tabId;
    tabs.forEach(tab => {
        if (tab.id === tabId) {
            tab.ui.classList.add('active');
            tab.webview.classList.add('active');
            urlInput.value = tab.webview.getURL() || '';
        } else {
            tab.ui.classList.remove('active');
            tab.webview.classList.remove('active');
        }
    });
}

function closeTab(tabId) {
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;
    
    const tab = tabs[tabIndex];
    tab.ui.remove();
    tab.webview.remove();
    tabs.splice(tabIndex, 1);
    
    if (tabs.length === 0) {
        ipcRenderer.send('window-close');
    } else if (activeTabId === tabId) {
        // Activate previous tab or next tab
        const nextIndex = Math.max(0, tabIndex - 1);
        activateTab(tabs[nextIndex].id);
    }
}

// Navigation Controls
newTabBtn.addEventListener('click', () => createTab());

backBtn.addEventListener('click', () => {
    const activeWebview = document.getElementById(activeTabId);
    if (activeWebview && activeWebview.canGoBack()) {
        activeWebview.goBack();
    }
});

forwardBtn.addEventListener('click', () => {
    const activeWebview = document.getElementById(activeTabId);
    if (activeWebview && activeWebview.canGoForward()) {
        activeWebview.goForward();
    }
});

reloadBtn.addEventListener('click', () => {
    const activeWebview = document.getElementById(activeTabId);
    if (activeWebview) {
        if (activeWebview.isLoading()) {
            activeWebview.stop();
        } else {
            activeWebview.reload();
        }
    }
});

function navigate() {
    let url = urlInput.value.trim();
    if (!url) return;
    
    // Simple URL parsing
    if (!/^https?:\/\//i.test(url) && !url.includes('://')) {
        if (url.includes('.') && !url.includes(' ')) {
            url = 'https://' + url;
        } else {
            // Search Google
            url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
        }
    }
    
    const activeWebview = document.getElementById(activeTabId);
    if (activeWebview) {
        activeWebview.loadURL(url);
    }
}

goBtn.addEventListener('click', navigate);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') navigate();
});

// --- Onboarding Logic ---
function initOnboarding() {
    const hasSeenOnboard = localStorage.getItem('qalorion_onboard_complete');
    
    if (!hasSeenOnboard) {
        const overlay = document.getElementById('onboard-overlay');
        overlay.style.display = 'flex';
        
        const nextBtn = document.getElementById('onboard-next-btn');
        const steps = [
            document.getElementById('step-1'),
            document.getElementById('step-2'),
            document.getElementById('step-3')
        ];
        const dots = document.querySelectorAll('.dot');
        
        let currentStep = 0;
        
        nextBtn.addEventListener('click', () => {
            steps[currentStep].style.display = 'none';
            dots[currentStep].classList.remove('active');
            
            currentStep++;
            
            if (currentStep < steps.length) {
                steps[currentStep].style.display = 'block';
                dots[currentStep].classList.add('active');
                
                if (currentStep === steps.length - 1) {
                    nextBtn.textContent = "Get Started";
                }
            } else {
                overlay.style.display = 'none';
                localStorage.setItem('qalorion_onboard_complete', 'true');
                // Open first tab after onboarding
                if (tabs.length === 0) {
                    createTab();
                }
            }
        });
    } else {
        // Normal startup
        createTab();
    }
}

// --- Downloads & Sniffer Logic ---
const downloadsBtn = document.getElementById('downloads-btn');
const snifferBtn = document.getElementById('sniffer-btn');
const downloadsOverlay = document.getElementById('downloads-overlay');
const snifferOverlay = document.getElementById('sniffer-overlay');
const closeDownloadsBtn = document.getElementById('close-downloads-btn');
const closeSnifferBtn = document.getElementById('close-sniffer-btn');
const downloadsList = document.getElementById('downloads-list');
const snifferList = document.getElementById('sniffer-list');
const clearSnifferBtn = document.getElementById('clear-sniffer-btn');

let detectedMedia = [];

downloadsBtn.addEventListener('click', () => {
    downloadsOverlay.style.display = 'flex';
});

closeDownloadsBtn.addEventListener('click', () => {
    downloadsOverlay.style.display = 'none';
});

snifferBtn.addEventListener('click', () => {
    snifferOverlay.style.display = 'flex';
});

closeSnifferBtn.addEventListener('click', () => {
    snifferOverlay.style.display = 'none';
});

clearSnifferBtn.addEventListener('click', () => {
    detectedMedia = [];
    renderSnifferList();
});

// Download Events
ipcRenderer.on('download-started', (e, item) => {
    showNotification('Download Started', item.filename);
    addDownloadItem(item);
});

ipcRenderer.on('download-progress', (e, item) => {
    updateDownloadItem(item);
});

ipcRenderer.on('download-completed', (e, item) => {
    showNotification('Download Complete', item.filename);
    finishDownloadItem(item, 'completed');
});

ipcRenderer.on('download-failed', (e, item) => {
    finishDownloadItem(item, 'failed');
});

function addDownloadItem(item) {
    const emptyMsg = downloadsList.querySelector('p');
    if (emptyMsg) emptyMsg.remove();

    const div = document.createElement('div');
    div.className = 'download-item';
    div.id = `dl-${item.filename.replace(/[^a-z0-9]/gi, '-')}`;
    div.innerHTML = `
        <div class="dl-info">
            <span class="dl-name">${item.filename}</span>
            <span class="dl-status">Starting...</span>
        </div>
        <div class="dl-progress-bar">
            <div class="dl-progress" style="width: 0%"></div>
        </div>
    `;
    downloadsList.prepend(div);
}

function updateDownloadItem(item) {
    const div = document.getElementById(`dl-${item.filename.replace(/[^a-z0-9]/gi, '-')}`);
    if (div) {
        const percent = Math.round((item.receivedBytes / item.totalBytes) * 100);
        div.querySelector('.dl-progress').style.width = `${percent}%`;
        div.querySelector('.dl-status').textContent = `${percent}% - ${(item.receivedBytes / 1024 / 1024).toFixed(1)} MB`;
    }
}

function finishDownloadItem(item, status) {
    const div = document.getElementById(`dl-${item.filename.replace(/[^a-z0-9]/gi, '-')}`);
    if (div) {
        div.querySelector('.dl-progress').style.width = status === 'completed' ? '100%' : '0%';
        div.querySelector('.dl-progress').style.background = status === 'completed' ? 'var(--primary-color)' : 'var(--danger-color)';
        div.querySelector('.dl-status').textContent = status === 'completed' ? 'Completed' : 'Failed';
        
        if (status === 'completed') {
             const openBtn = document.createElement('button');
             openBtn.className = 'icon-btn';
             openBtn.innerHTML = '<i class="fa-solid fa-folder-open"></i>';
             openBtn.onclick = () => { /* Open folder logic could go here */ };
             div.appendChild(openBtn);
        }
    }
}

// Media Sniffer Events
ipcRenderer.on('media-detected', (e, media) => {
    // Avoid duplicates
    if (!detectedMedia.some(m => m.url === media.url)) {
        detectedMedia.push(media);
        renderSnifferList();
        
        // Notify user about media
        const typeName = media.mimeType.split('/')[0].toUpperCase();
        showNotification(`${typeName} Detected`, 'Added to Media Sniffer');
        
        // Animate button to alert user
        snifferBtn.style.color = 'var(--primary-color)';
        setTimeout(() => snifferBtn.style.color = '', 1000);
    }
});

function renderSnifferList() {
    snifferList.innerHTML = '';
    
    if (detectedMedia.length === 0) {
        snifferList.innerHTML = '<p style="text-align: center; color: #888; font-size: 13px;">No media detected yet. Play a video or music!</p>';
        return;
    }

    detectedMedia.forEach(media => {
        const div = document.createElement('div');
        div.className = 'sniffer-item';
        
        let icon = 'fa-file';
        if (media.mimeType.startsWith('video')) icon = 'fa-video';
        if (media.mimeType.startsWith('audio')) icon = 'fa-music';
        if (media.mimeType.startsWith('image')) icon = 'fa-image';

        div.innerHTML = `
            <div class="sniffer-icon"><i class="fa-solid ${icon}"></i></div>
            <div class="sniffer-info">
                <span class="sniffer-url" title="${media.url}">${media.url}</span>
                <span class="sniffer-meta">${media.mimeType} • ${formatBytes(media.size)}</span>
            </div>
            <button class="primary-btn dl-media-btn"><i class="fa-solid fa-download"></i></button>
        `;
        
        div.querySelector('.dl-media-btn').addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = media.url;
            a.download = ''; // Trigger download
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });

        snifferList.prepend(div);
    });
}

function formatBytes(bytes) {
    if (bytes === 'Unknown') return bytes;
    const b = parseInt(bytes);
    if (isNaN(b)) return 'Stream';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (b === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(b) / Math.log(1024)));
    return Math.round(b / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

// Initialize
initOnboarding();

// --- Settings & Themes ---
const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const themeSelect = document.getElementById('theme-select');
const resetBrowserBtn = document.getElementById('reset-browser-btn');
const keepDataCb = document.getElementById('keep-data-cb');
const hyperislandToggle = document.getElementById('hyperisland-toggle');

// New Settings Elements
const clearExitCb = document.getElementById('clear-exit-cb');
const clearDataNowBtn = document.getElementById('clear-data-now-btn');

settingsBtn.addEventListener('click', () => {
    settingsOverlay.style.display = 'flex';
});

closeSettingsBtn.addEventListener('click', () => {
    settingsOverlay.style.display = 'none';
});

// Load saved theme
const savedTheme = localStorage.getItem('qalorion_theme') || 'dark';
document.body.className = `theme-${savedTheme}`;
themeSelect.value = savedTheme;

themeSelect.addEventListener('change', (e) => {
    const theme = e.target.value;
    document.body.className = `theme-${theme}`;
    localStorage.setItem('qalorion_theme', theme);
});

// Load HyperIsland preference
const hyperIslandEnabled = localStorage.getItem('qalorion_hyperisland') !== 'false';
hyperislandToggle.checked = hyperIslandEnabled;

hyperislandToggle.addEventListener('change', (e) => {
    localStorage.setItem('qalorion_hyperisland', e.target.checked);
});

// Privacy Settings
clearExitCb.checked = localStorage.getItem('qalorion_clear_exit') === 'true';
clearExitCb.addEventListener('change', (e) => {
    localStorage.setItem('qalorion_clear_exit', e.target.checked);
});

clearDataNowBtn.addEventListener('click', () => {
    if (confirm("Clear all browsing data (cookies, cache, history) now?")) {
        ipcRenderer.send('clear-data');
    }
});

// Handle Clear on Exit (Check on startup)
if (localStorage.getItem('qalorion_clear_exit') === 'true') {
    // We actually want to clear on exit, but since we can't reliably do async on close,
    // we clear on next startup or send a sync message. 
    // Better: Send a message to main to clear session now if it was just opened.
    // For now, let's just use the button or assume the user wants it done.
    // Real implementation would be in main process 'before-quit'.
    // Here we just toggle the preference.
}

// Reset Browser Logic
resetBrowserBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to reset the browser?")) {
        const keepData = keepDataCb.checked;
        
        // Always remove onboarding so it shows again
        localStorage.removeItem('qalorion_onboard_complete');
        
        if (!keepData) {
            // Remove everything except what's necessary to start
            localStorage.clear();
        }
        
        // Restart app via main process
        ipcRenderer.send('restart-app');
    }
});

// --- HyperIsland Notifications ---
const hyperIsland = document.getElementById('hyper-island');
const islandTitle = document.getElementById('island-title');
const islandMessage = document.getElementById('island-message');

let islandTimeout;

function showNotification(title, message, duration = 4000) {
    // Check if user disabled it in settings
    if (localStorage.getItem('qalorion_hyperisland') === 'false') return;

    islandTitle.textContent = title;
    islandMessage.textContent = message;
    
    hyperIsland.classList.add('show');
    
    clearTimeout(islandTimeout);
    islandTimeout = setTimeout(() => {
        hyperIsland.classList.remove('show');
    }, duration);
}

// Listen for auto-update notifications from main process
ipcRenderer.on('hyper-notify', (e, data) => {
    showNotification(data.title, data.message, data.duration);
});

// Test notification on load if enabled
setTimeout(() => {
    showNotification("System", "Qalorion Browser loaded successfully.", 3000);
}, 2000);