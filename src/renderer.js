const { ipcRenderer } = require('electron');

// --- Helper for Robust IPC ---
function sendIPC(channel, ...args) {
    try {
        ipcRenderer.send(channel, ...args);
    } catch (e) {
        console.error(`Failed to send IPC message on channel ${channel}:`, e);
    }
}

// --- Window Controls ---
const minimizeBtn = document.getElementById('minimize-btn');
const maximizeBtn = document.getElementById('maximize-btn');
const closeBtn = document.getElementById('close-btn');

if (minimizeBtn) minimizeBtn.addEventListener('click', () => sendIPC('window-minimize'));
if (maximizeBtn) maximizeBtn.addEventListener('click', () => sendIPC('window-maximize'));
if (closeBtn) closeBtn.addEventListener('click', () => sendIPC('window-close'));

// --- Browser Logic ---
const tabBar = document.getElementById('tab-bar');
const webviewContainer = document.getElementById('webview-container');
const urlInput = document.getElementById('url-input');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const goBtn = document.getElementById('go-btn');
const newTabBtn = document.getElementById('new-tab-btn');
const downloadsBtn = document.getElementById('downloads-btn');

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
    if (url.startsWith('file://')) {
        webview.setAttribute('webpreferences', 'nodeIntegration=yes, contextIsolation=no');
    }
    
    // Insert Elements
    tabBar.insertBefore(tabEl, newTabBtn);
    webviewContainer.appendChild(webview);
    
    const tabObj = { id: tabId, ui: tabEl, webview: webview, group: null };
    tabs.push(tabObj);
    
    // Tab Event Listeners
    tabEl.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-close')) {
            activateTab(tabId);
        }
    });
    
    // Tab Context Menu for Groups
    tabEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const colors = ['#f38ba8', '#a6e3a1', '#89b4fa', '#f9e2af', 'transparent'];
        let colorMenu = document.createElement('div');
        colorMenu.className = 'group-menu';
        colorMenu.style.left = `${e.clientX}px`;
        colorMenu.style.top = `${e.clientY}px`;
        
        colors.forEach(color => {
            let colorBtn = document.createElement('button');
            colorBtn.style.backgroundColor = color;
            if (color === 'transparent') colorBtn.textContent = 'None';
            colorBtn.onclick = () => {
                tabObj.group = color;
                tabEl.style.borderTop = color === 'transparent' ? 'none' : `3px solid ${color}`;
                colorMenu.remove();
            };
            colorMenu.appendChild(colorBtn);
        });
        
        document.body.appendChild(colorMenu);
        
        // Remove on click elsewhere
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                if (document.body.contains(colorMenu)) colorMenu.remove();
                document.removeEventListener('click', removeMenu);
            });
        }, 10);
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
        sendIPC('window-close');
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

// Initialize
initOnboarding();

// --- Downloads ---
if (downloadsBtn) {
    downloadsBtn.addEventListener('click', () => {
        createTab('file://' + __dirname + '/downloads.html');
    });
}

let downloadsList = [];
ipcRenderer.on('download-started', (e, item) => {
    downloadsList.push(item);
    showNotification('Download Started', item.filename);
});

// --- Settings & Themes ---
const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const themeSelect = document.getElementById('theme-select');
const resetBrowserBtn = document.getElementById('reset-browser-btn');
const keepDataCb = document.getElementById('keep-data-cb');
const hyperislandToggle = document.getElementById('hyperisland-toggle');
const heliumToggle = document.getElementById('helium-toggle');
const adBlockToggle = document.getElementById('adblock-toggle');

// New Settings Elements
const clearExitCb = document.getElementById('clear-exit-cb');
const clearDataNowBtn = document.getElementById('clear-data-now-btn');

if (settingsBtn && settingsOverlay) {
    settingsBtn.addEventListener('click', () => {
        settingsOverlay.style.display = 'flex';
    });
}

if (closeSettingsBtn && settingsOverlay) {
    closeSettingsBtn.addEventListener('click', () => {
        settingsOverlay.style.display = 'none';
    });
}

// Close settings when clicking outside
if (settingsOverlay) {
    settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) {
            settingsOverlay.style.display = 'none';
        }
    });
}

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

// Load Helium Mode preference
if (heliumToggle) {
    heliumToggle.addEventListener('change', (e) => {
        sendIPC('toggle-helium', e.target.checked);
    });
}

// Privacy Settings
if (clearExitCb) {
    clearExitCb.checked = localStorage.getItem('qalorion_clear_exit') === 'true';
    clearExitCb.addEventListener('change', (e) => {
        localStorage.setItem('qalorion_clear_exit', e.target.checked);
    });
}

if (clearDataNowBtn) {
    clearDataNowBtn.addEventListener('click', () => {
        if (confirm("Clear all browsing data (cookies, cache, history) now?")) {
            sendIPC('clear-data');
        }
    });
}

// Reset Browser Logic
if (resetBrowserBtn) {
    resetBrowserBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to reset the browser?")) {
            const keepData = keepDataCb ? keepDataCb.checked : false;
            localStorage.removeItem('qalorion_onboard_complete');
            if (!keepData) localStorage.clear();
            sendIPC('restart-app');
        }
    });
}

// --- HyperIsland Notifications ---
const hyperIsland = document.getElementById('hyper-island');
const islandTitle = document.getElementById('island-title');
const islandMessage = document.getElementById('island-message');

let islandTimeout;

function showNotification(title, message, duration = 4000) {
    if (localStorage.getItem('qalorion_hyperisland') === 'false') return;

    islandTitle.textContent = title;
    islandMessage.textContent = message;
    
    hyperIsland.classList.add('show');
    
    clearTimeout(islandTimeout);
    islandTimeout = setTimeout(() => {
        hyperIsland.classList.remove('show');
    }, duration);
}

ipcRenderer.on('hyper-notify', (e, data) => {
    showNotification(data.title, data.message, data.duration);
});