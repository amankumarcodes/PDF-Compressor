// PDF Compression Worker
// This file handles the actual PDF compression in a web worker to prevent UI freezing

// Import the required libraries
importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');

// Listen for messages from the main thread
self.addEventListener('message', async (e) => {
  try {
    const { pdfArrayBuffer, settings } = e.data;
    
    // Send progress update
    self.postMessage({ type: 'progress', percentage: 10, message: 'Loading PDF...' });
    
    // Load the PDF document
    const pdfDoc = await PDFLib.PDFDocument.load(pdfArrayBuffer, {
      ignoreEncryption: false,
      updateMetadata: !settings.removeMetadata
    });
    
    self.postMessage({ type: 'progress', percentage: 30, message: 'Analyzing PDF structure...' });
    
    // Get document information
    const pageCount = pdfDoc.getPageCount();
    
    self.postMessage({ 
      type: 'progress', 
      percentage: 40, 
      message: `Processing ${pageCount} pages...` 
    });
    
    // Apply compression settings based on mode
    if (settings.removeMetadata) {
      // Remove metadata
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('PDF Compressor');
      pdfDoc.setCreator('PDF Compressor');
    }
    
    // Process pages based on compression settings
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);
      
      // In a real implementation, we would compress images on each page
      // based on the quality setting. For now, we're preserving the original content.
      
      // Update progress based on page processing
      const progress = 40 + Math.floor((i / pageCount) * 40);
      self.postMessage({ 
        type: 'progress', 
        percentage: progress, 
        message: `Processing page ${i + 1} of ${pageCount}...` 
      });
    }
    
    self.postMessage({ type: 'progress', percentage: 80, message: 'Finalizing compressed PDF...' });
    
    // Save the PDF with appropriate compression options
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true,  // This helps with compression
      addDefaultPage: false,
      preserveExistingContent: true
    });
    
    // Calculate compression ratio
    const compressionRatio = pdfBytes.length / pdfArrayBuffer.byteLength;
    const compressedSize = pdfBytes.length;
    
    self.postMessage({ 
      type: 'progress', 
      percentage: 100, 
      message: 'Compression complete!' 
    });
    
    // Send the compressed PDF back to the main thread
    self.postMessage({ 
      type: 'complete', 
      compressedPdf: pdfBytes.buffer,
      originalSize: pdfArrayBuffer.byteLength,
      compressedSize: compressedSize
    }, [pdfBytes.buffer]);
    
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
});

// Send ready message
self.postMessage({ type: 'ready' });
