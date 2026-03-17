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
    
    activateTab(tabId);
}

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

// Initialize
initOnboarding();