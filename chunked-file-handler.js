// Chunked File Handler
// This file handles chunked file processing for large PDFs up to 500MB

class ChunkedFileHandler {
  constructor(options = {}) {
    // Default chunk size: 5MB
    this.chunkSize = options.chunkSize || 5 * 1024 * 1024;
    this.file = null;
    this.chunks = [];
    this.totalChunks = 0;
    this.processedChunks = 0;
    this.onProgress = options.onProgress || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});
  }

  // Set the file to be processed
  setFile(file) {
    this.file = file;
    this.totalChunks = Math.ceil(file.size / this.chunkSize);
    this.chunks = [];
    this.processedChunks = 0;
    return this.totalChunks;
  }

  // Process the file in chunks
  async processFile() {
    if (!this.file) {
      this.onError(new Error('No file selected'));
      return;
    }

    try {
      // Create array to hold all chunks
      const chunksArray = new Array(this.totalChunks);
      
      // Process each chunk
      const chunkPromises = [];
      
      for (let i = 0; i < this.totalChunks; i++) {
        const start = i * this.chunkSize;
        const end = Math.min(start + this.chunkSize, this.file.size);
        
        // Create a chunk of the file
        const chunk = this.file.slice(start, end);
        
        // Process the chunk
        const chunkPromise = this.processChunk(chunk, i).then(processedChunk => {
          chunksArray[i] = processedChunk;
          this.processedChunks++;
          
          // Report progress
          const progress = Math.floor((this.processedChunks / this.totalChunks) * 100);
          this.onProgress(progress, `Processing chunk ${this.processedChunks} of ${this.totalChunks}`);
        });
        
        chunkPromises.push(chunkPromise);
      }
      
      // Wait for all chunks to be processed
      await Promise.all(chunkPromises);
      
      // Combine all chunks
      const combinedBuffer = this.combineChunks(chunksArray);
      
      // Call the complete callback
      this.onComplete(combinedBuffer);
      
    } catch (error) {
      this.onError(error);
    }
  }

  // Process a single chunk
  async processChunk(chunk, index) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        resolve(reader.result);
      };
      
      reader.onerror = () => {
        reject(new Error(`Error reading chunk ${index}`));
      };
      
      reader.readAsArrayBuffer(chunk);
    });
  }

  // Combine all chunks into a single ArrayBuffer
  combineChunks(chunksArray) {
    // Calculate total size
    let totalSize = 0;
    for (const chunk of chunksArray) {
      totalSize += chunk.byteLength;
    }
    
    // Create a new buffer of the total size
    const combinedBuffer = new ArrayBuffer(totalSize);
    const combinedView = new Uint8Array(combinedBuffer);
    
    // Copy each chunk into the combined buffer
    let offset = 0;
    for (const chunk of chunksArray) {
      combinedView.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    
    return combinedBuffer;
  }
}

// Export the class for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChunkedFileHandler;
}
