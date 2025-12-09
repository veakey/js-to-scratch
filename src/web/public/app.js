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
    if (!file.name.endsWith('.js')) {
        showError({
            message: 'Invalid file type. Please upload a .js file.',
        });
        return;
    }
    
    // Validate file size (1MB limit)
    const maxSize = 1 * 1024 * 1024; // 1MB
    if (file.size > maxSize) {
        showError({
            message: 'File size exceeds 1MB limit. Please use a smaller file.',
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

        const result = await response.json();

        if (result.success) {
            showResult(result.project);
        } else {
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

        const result = await response.json();

        if (result.success) {
            showResult(result.project);
        } else {
            showError(result);
        }
    } catch (error) {
        showError({
            message: `Failed to translate: ${error.message}`,
        });
    }
});

// Download button handler
downloadBtn.addEventListener('click', () => {
    if (!currentResult) return;

    const blob = new Blob([JSON.stringify(currentResult, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.sb3.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Show loading state
function showLoading() {
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';
    translateBtn.disabled = true;
    translateBtn.textContent = '⏳ Translating...';
}

// Show result
function showResult(project) {
    currentResult = project;
    
    resultSection.style.display = 'block';
    errorSection.style.display = 'none';
    translateBtn.disabled = false;
    translateBtn.textContent = '🔄 Translate to Scratch';

    // Count blocks
    const blockCount = Object.keys(project.targets[1].blocks || {}).length;

    resultContent.innerHTML = `
        <div class="result-info">
            <strong>✓</strong> Translation completed successfully!
        </div>
        <div class="result-info">
            <strong>Blocks created:</strong> ${blockCount}
        </div>
        <div class="result-info">
            <strong>Format:</strong> Scratch 3.0
        </div>
        <div class="result-info">
            💡 Click the download button below to save the Scratch project file.
        </div>
    `;
}

// Show error
function showError(error) {
    resultSection.style.display = 'none';
    errorSection.style.display = 'block';
    translateBtn.disabled = false;
    translateBtn.textContent = '🔄 Translate to Scratch';

    let errorHTML = '';

    if (error.feature) {
        // Unsupported feature error
        errorHTML = `
            <div class="error-detail">
                <strong>⚠️ Unsupported Feature Detected</strong>
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
                📝 The feature <code>${error.feature}</code> does not exist in Scratch.
                <br>Please remove or replace this feature and try again.
            </div>
        `;
    } else {
        // General error
        errorHTML = `
            <div class="error-detail">
                <strong>Error:</strong> ${error.error || error.message}
            </div>
        `;
    }

    errorContent.innerHTML = errorHTML;
}

// Initialize
console.log('🎨 JS to Scratch Translator loaded');
