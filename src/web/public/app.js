// State management
let currentResult = null;

// DOM elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const codeEditor = document.getElementById('codeEditor');
const translateBtn = document.getElementById('translateBtn');
const resultSection = document.getElementById('resultSection');
const errorSection = document.getElementById('errorSection');
const resultContent = document.getElementById('resultContent');
const errorContent = document.getElementById('errorContent');
const downloadBtn = document.getElementById('downloadBtn');
const toastContainer = document.getElementById('toastContainer');

// Toast notification function
function showToast(message, type = 'error', details = null, duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const title = type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info';
    
    let toastHTML = `
        <div class="toast-header">
            <span>${title}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="toast-message">${message}</div>
    `;
    
    if (details) {
        toastHTML += `<div class="toast-detail">${details}</div>`;
    }
    
    toast.innerHTML = toastHTML;
    toastContainer.appendChild(toast);
    
    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300); // Match animation duration
        }, duration);
    }
    
    return toast;
}

// Drag and drop handlers
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
    }
});

// File upload handler
async function handleFileUpload(file) {
    // Validate file extension
    if (!file.name.endsWith('.js') && !file.name.endsWith('.zip')) {
        showError({
            message: 'Invalid file type. Please upload a .js or .zip file.',
        });
        return;
    }
    
    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showError({
            message: 'File size exceeds 10MB limit. Please use a smaller file.',
        });
        return;
    }
    
    // Validate file is not empty
    if (file.size === 0) {
        showError({
            message: 'File is empty. Please upload a valid JavaScript file.',
        });
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        showLoading();
        const response = await fetch('/api/translate', {
            method: 'POST',
            body: formData,
        });

        // Check if response is a file download
        if (response.headers.get('content-type') === 'application/octet-stream' ||
            response.headers.get('content-disposition')?.includes('attachment')) {
            // Download the .sb3 file
            const blob = await response.blob();
            downloadFile(blob, 'project.sb3');
            showSuccess();
        } else {
            // Error response
            const result = await response.json();
            showError(result);
        }
    } catch (error) {
        showError({
            message: `Failed to translate: ${error.message}`,
        });
    }
}

// Translate button handler
translateBtn.addEventListener('click', async () => {
    const code = codeEditor.value.trim();

    if (!code) {
        showError({
            message: 'Please enter some JavaScript code to translate.',
        });
        return;
    }

    try {
        showLoading();
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code }),
        });

        // Check if response is a file download
        if (response.headers.get('content-type') === 'application/octet-stream' ||
            response.headers.get('content-disposition')?.includes('attachment')) {
            // Download the .sb3 file
            const blob = await response.blob();
            downloadFile(blob, 'project.sb3');
            showSuccess();
        } else {
            // Error response
            const result = await response.json();
            showError(result);
        }
    } catch (error) {
        showError({
            message: `Failed to translate: ${error.message}`,
        });
    }
});

// Helper function to download file
function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Show loading state
function showLoading() {
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';
    translateBtn.disabled = true;
    translateBtn.textContent = 'Translating...';
}

// Show success message
function showSuccess() {
    resultSection.style.display = 'block';
    errorSection.style.display = 'none';
    translateBtn.disabled = false;
    translateBtn.textContent = 'Translate to Scratch';

    resultContent.innerHTML = `
        <div class="result-info">
            <strong>✓</strong> Translation completed successfully!
        </div>
        <div class="result-info">
            <strong>Format:</strong> Scratch 3.0 (.sb3)
        </div>
        <div class="result-info">
            Your .sb3 file has been downloaded automatically!
        </div>
        <div class="result-info">
            You can now upload it to <a href="https://scratch.mit.edu/" target="_blank">scratch.mit.edu</a>
        </div>
    `;
    
    // Show success toast
    showToast('Translation completed successfully!', 'success', 'Your .sb3 file has been downloaded.', 3000);
}

// Show error
function showError(error) {
    resultSection.style.display = 'none';
    errorSection.style.display = 'block';
    translateBtn.disabled = false;
    translateBtn.textContent = 'Translate to Scratch';

    let errorHTML = '';
    let toastMessage = '';
    let toastDetails = null;

    if (error.feature) {
        // Unsupported feature error
        toastMessage = `Unsupported feature: ${error.feature}`;
        toastDetails = `Found at line ${error.line}, column ${error.column}. This feature does not exist in Scratch.`;
        
        errorHTML = `
            <div class="error-detail">
                <strong>Unsupported Feature Detected</strong>
            </div>
            <div class="error-detail">
                <strong>Feature:</strong> ${error.feature}
            </div>
            <div class="error-detail">
                <strong>Location:</strong> Line ${error.line}, Column ${error.column}
            </div>
            <div class="error-message">
                ${error.message}
            </div>
            <div class="error-detail" style="margin-top: 15px;">
                The feature <code>${error.feature}</code> does not exist in Scratch.
                <br>Please remove or replace this feature and try again.
            </div>
        `;
    } else {
        // General error
        toastMessage = error.error || error.message;
        
        errorHTML = `
            <div class="error-detail">
                <strong>Error:</strong> ${error.error || error.message}
            </div>
        `;
    }

    errorContent.innerHTML = errorHTML;
    
    // Show toast notification
    showToast(toastMessage, 'error', toastDetails);
}

// Initialize
console.log('JS to Scratch Translator loaded');
