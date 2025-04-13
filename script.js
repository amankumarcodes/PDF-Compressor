// DOM Elements
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const fileName = document.getElementById('file-name');
const compressBtn = document.getElementById('compress-btn');
const qualitySlider = document.getElementById('quality-slider');
const qualityValue = document.getElementById('quality-value');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const compressionStats = document.getElementById('compression-stats');
const resultSection = document.getElementById('result-section');
const originalSize = document.getElementById('original-size');
const compressedSize = document.getElementById('compressed-size');
const reductionPercentage = document.getElementById('reduction-percentage');
const downloadBtn = document.getElementById('download-btn');
const compressAnotherBtn = document.getElementById('compress-another-btn');

// Variables
let selectedFile = null;
let compressedPdfBytes = null;
let compressionMode = 'lossless';
let compressionWorker = null;

// Initialize Web Worker
function initCompressionWorker() {
    if (compressionWorker) {
        compressionWorker.terminate();
    }
    
    compressionWorker = new Worker('compression-worker.js');
    
    compressionWorker.addEventListener('message', (e) => {
        const data = e.data;
        
        if (data.type === 'progress') {
            updateProgress(data.percentage, data.message);
        } else if (data.type === 'complete') {
            // Get the compressed PDF data
            compressedPdfBytes = new Uint8Array(data.compressedPdf);
            
            // Calculate compression stats
            const originalSizeInMB = data.originalSize / (1024 * 1024);
            const compressedSizeInMB = data.compressedSize / (1024 * 1024);
            const reduction = ((data.originalSize - data.compressedSize) / data.originalSize) * 100;
            
            // Update result section
            originalSize.textContent = `${originalSizeInMB.toFixed(2)} MB`;
            compressedSize.textContent = `${compressedSizeInMB.toFixed(2)} MB`;
            reductionPercentage.textContent = `${reduction.toFixed(2)}%`;
            
            // Show result section
            setTimeout(() => {
                progressSection.style.display = 'none';
                resultSection.style.display = 'block';
            }, 1000);
        } else if (data.type === 'error') {
            console.error('Worker error:', data.message);
            alert('An error occurred while compressing the PDF: ' + data.message);
            resetUI();
        }
    });
    
    compressionWorker.addEventListener('error', (error) => {
        console.error('Worker error:', error);
        alert('An error occurred in the compression worker. Please try again.');
        resetUI();
    });
}

// Initialize worker on page load
initCompressionWorker();

// Event Listeners
dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('drag-over');
});

dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('drag-over');
});

dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('drag-over');
    
    if (e.dataTransfer.files.length) {
        handleFileSelection(e.dataTransfer.files[0]);
    }
});

dropArea.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFileSelection(e.target.files[0]);
    }
});

qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = `${qualitySlider.value}%`;
});

document.querySelectorAll('input[name="compression-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        compressionMode = e.target.value;
        
        // Adjust quality slider based on compression mode
        if (compressionMode === 'lossless') {
            qualitySlider.value = 100;
            qualitySlider.disabled = true;
        } else if (compressionMode === 'balanced') {
            qualitySlider.value = 80;
            qualitySlider.disabled = false;
        } else if (compressionMode === 'maximum') {
            qualitySlider.value = 60;
            qualitySlider.disabled = false;
        }
        
        qualityValue.textContent = `${qualitySlider.value}%`;
    });
});

compressBtn.addEventListener('click', compressPDF);

downloadBtn.addEventListener('click', () => {
    if (compressedPdfBytes) {
        const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
        saveAs(blob, `compressed_${selectedFile.name}`);
    }
});

compressAnotherBtn.addEventListener('click', resetUI);

// Functions
function handleFileSelection(file) {
    // Check if file is PDF
    if (file.type !== 'application/pdf') {
        alert('Please select a PDF file.');
        return;
    }
    
    // Check file size (500MB limit)
    if (file.size > 500 * 1024 * 1024) {
        alert('File size exceeds the 500MB limit.');
        return;
    }
    
    selectedFile = file;
    fileName.textContent = file.name;
    compressBtn.disabled = false;
}

async function compressPDF() {
    if (!selectedFile) return;
    
    // Show progress section
    progressSection.style.display = 'block';
    resultSection.style.display = 'none';
    compressBtn.disabled = true;
    
    try {
        // Check if file is large (over 10MB)
        const isLargeFile = selectedFile.size > 10 * 1024 * 1024;
        
        if (isLargeFile) {
            // Use chunked processing for large files
            updateProgress(5, 'Preparing to process large file in chunks...');
            
            // Initialize chunked file handler
            const chunkedHandler = new ChunkedFileHandler({
                chunkSize: 5 * 1024 * 1024, // 5MB chunks
                onProgress: (progress, message) => {
                    // Map chunk progress to 5-30% of overall progress
                    const mappedProgress = 5 + Math.floor(progress * 0.25);
                    updateProgress(mappedProgress, message);
                },
                onComplete: (combinedBuffer) => {
                    // Process the combined buffer
                    updateProgress(30, 'File chunks combined. Starting compression...');
                    
                    // Get compression settings
                    const compressionSettings = getCompressionSettings();
                    
                    // Send the PDF data to the worker for compression
                    compressionWorker.postMessage({
                        pdfArrayBuffer: combinedBuffer,
                        settings: compressionSettings
                    }, [combinedBuffer]);
                },
                onError: (error) => {
                    console.error('Error in chunked processing:', error);
                    alert('An error occurred while processing the large PDF file. Please try again.');
                    resetUI();
                }
            });
            
            // Set the file and start processing
            chunkedHandler.setFile(selectedFile);
            chunkedHandler.processFile();
        } else {
            // Standard processing for smaller files
            // Read the file
            const fileData = await readFileAsArrayBuffer(selectedFile);
            
            // Update initial progress
            updateProgress(10, 'Preparing compression...');
            
            // Get compression settings
            const compressionSettings = getCompressionSettings();
            
            // Send the PDF data to the worker for compression
            compressionWorker.postMessage({
                pdfArrayBuffer: fileData,
                settings: compressionSettings
            }, [fileData]);
        }
    } catch (error) {
        console.error('Error preparing PDF for compression:', error);
        alert('An error occurred while preparing the PDF. Please try again.');
        resetUI();
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function getCompressionSettings() {
    const quality = parseInt(qualitySlider.value) / 100;
    
    const settings = {
        quality: quality,
        compressImages: compressionMode !== 'lossless',
        compressText: compressionMode === 'maximum',
        removeMetadata: compressionMode === 'maximum',
        mergeDuplicateObjects: true
    };
    
    return settings;
}

function updateProgress(percentage, message) {
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${percentage}%`;
    compressionStats.textContent = message;
}

function resetUI() {
    // Reset file selection
    selectedFile = null;
    compressedPdfBytes = null;
    fileName.textContent = '';
    fileInput.value = '';
    
    // Reset compression options
    document.getElementById('mode-lossless').checked = true;
    qualitySlider.value = 90;
    qualitySlider.disabled = false;
    qualityValue.textContent = '90%';
    
    // Reset UI sections
    compressBtn.disabled = true;
    progressSection.style.display = 'none';
    resultSection.style.display = 'none';
    
    // Reinitialize worker
    initCompressionWorker();
}

// Initialize UI
resetUI();
