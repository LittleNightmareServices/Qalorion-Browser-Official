const { ipcRenderer } = require('electron');

const downloadsList = document.getElementById('downloads-list');
const emptyMsg = document.getElementById('empty-msg');

ipcRenderer.on('download-started', (e, item) => {
    if (emptyMsg) emptyMsg.style.display = 'none';
    addDownloadItem(item);
});

ipcRenderer.on('download-progress', (e, item) => {
    updateDownloadItem(item);
});

ipcRenderer.on('download-completed', (e, item) => {
    finishDownloadItem(item, 'completed');
});

ipcRenderer.on('download-failed', (e, item) => {
    finishDownloadItem(item, 'failed');
});

function addDownloadItem(item) {
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
    downloadsList.appendChild(div);
}

function updateDownloadItem(item) {
    const div = document.getElementById(`dl-${item.filename.replace(/[^a-z0-9]/gi, '-')}`);
    if (div) {
        const percent = Math.round((item.receivedBytes / item.totalBytes) * 100);
        div.querySelector('.dl-progress').style.width = `${percent}%`;
        div.querySelector('.dl-status').textContent = `${percent}% - ${(item.receivedBytes / 1024 / 1024).toFixed(1)} MB / ${(item.totalBytes / 1024 / 1024).toFixed(1)} MB`;
    }
}

function finishDownloadItem(item, status) {
    const div = document.getElementById(`dl-${item.filename.replace(/[^a-z0-9]/gi, '-')}`);
    if (div) {
        div.querySelector('.dl-progress').style.width = status === 'completed' ? '100%' : '0%';
        div.querySelector('.dl-progress').style.background = status === 'completed' ? 'var(--primary-color)' : 'var(--danger-color)';
        div.querySelector('.dl-status').textContent = status === 'completed' ? 'Completed' : 'Failed';
    }
}
