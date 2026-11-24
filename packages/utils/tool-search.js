/**
 * Chronos Toolbox — Shared Search Initialization
 * This script initializes the search functionality for all tool hub pages.
 */

'use strict';

const ToolSearch = (() => {
  // All tools data for search (used by SearchBar)
  const allTools = [
    // Doc Converter tools
    { id: 'pdf-to-word', title: 'PDF to Word', description: 'Convert PDF to editable Word document', category: 'Doc Converter', url: '../doc-converter/tools/pdf-to-word/index.html', tags: ['pdf', 'word', 'docx', 'convert'] },
    { id: 'word-to-pdf', title: 'Word to PDF', description: 'Convert Word documents to PDF', category: 'Doc Converter', url: '../doc-converter/tools/word-to-pdf/index.html', tags: ['word', 'docx', 'pdf', 'convert'] },
    { id: 'pptx-to-pdf', title: 'PowerPoint to PDF', description: 'Convert presentations to PDF', category: 'Doc Converter', url: '../doc-converter/tools/pptx-to-pdf/index.html', tags: ['pptx', 'powerpoint', 'pdf', 'convert'] },
    { id: 'pdf-to-jpg', title: 'PDF to JPG', description: 'Extract pages as images from PDF', category: 'Doc Converter', url: '../doc-converter/tools/pdf-to-jpg/index.html', tags: ['pdf', 'jpg', 'image', 'convert'] },
    { id: 'jpg-to-pdf', title: 'JPG to PDF', description: 'Combine images into a PDF', category: 'Doc Converter', url: '../doc-converter/tools/jpg-to-pdf/index.html', tags: ['jpg', 'image', 'pdf', 'convert'] },
    { id: 'merge-pdf', title: 'Merge PDF', description: 'Combine multiple PDFs into one', category: 'Doc Converter', url: '../doc-converter/tools/merge-pdf/index.html', tags: ['pdf', 'merge', 'combine'] },
    { id: 'split-pdf', title: 'Split PDF', description: 'Extract pages from PDF', category: 'Doc Converter', url: '../doc-converter/tools/split-pdf/index.html', tags: ['pdf', 'split', 'extract', 'pages'] },
    { id: 'rotate-pdf', title: 'Rotate PDF', description: 'Rotate PDF pages', category: 'Doc Converter', url: '../doc-converter/tools/rotate-pdf/index.html', tags: ['pdf', 'rotate', 'orientation'] },
    { id: 'page-deleter', title: 'PDF Page Deleter', description: 'Delete pages from PDF', category: 'Doc Converter', url: '../doc-converter/tools/page-deleter/index.html', tags: ['pdf', 'delete', 'remove', 'pages'] },
    { id: 'rearrange-pdf', title: 'Rearrange PDF', description: 'Reorder PDF pages', category: 'Doc Converter', url: '../doc-converter/tools/rearrange-pdf/index.html', tags: ['pdf', 'reorder', 'arrange', 'pages'] },
    { id: 'pdf-to-audio', title: 'PDF to Audio', description: 'Listen to PDF as spoken audio', category: 'Doc Converter', url: '../doc-converter/tools/pdf-to-audio/index.html', tags: ['pdf', 'audio', 'tts', 'speech', 'listen'] },
    { id: 'compress-word', title: 'Compress Word', description: 'Reduce Word file size', category: 'Doc Converter', url: '../doc-converter/tools/compress-word/index.html', tags: ['word', 'docx', 'compress', 'reduce', 'size'] },
    { id: 'compress-pdf', title: 'Compress PDF', description: 'Reduce PDF file size', category: 'Doc Converter', url: '../doc-converter/tools/compress-pdf/index.html', tags: ['pdf', 'compress', 'reduce', 'size'] },
    { id: 'compress-pptx', title: 'Compress PPTX', description: 'Reduce PowerPoint file size', category: 'Doc Converter', url: '../doc-converter/tools/compress-pptx/index.html', tags: ['pptx', 'powerpoint', 'compress', 'reduce', 'size'] },
    { id: 'text-translator', title: 'Text Translator', description: 'Translate text between 50+ languages', category: 'Doc Converter', url: '../doc-converter/tools/text-translator/index.html', tags: ['translate', 'text', 'language', 'multilingual'] },
    
    // Image Editor tools
    { id: 'image-converter', title: 'Image Converter', description: 'Convert between image formats', category: 'Image Editor', url: '../image-editor/tools/image-converter/index.html', tags: ['image', 'convert', 'png', 'jpg', 'webp'] },
    { id: 'heic-to-jpg', title: 'HEIC to JPG', description: 'Convert Apple HEIC photos to JPG', category: 'Image Editor', url: '../image-editor/tools/heic-to-jpg/index.html', tags: ['heic', 'jpg', 'apple', 'iphone', 'convert'] },
    { id: 'crop-resize', title: 'Crop & Resize', description: 'Crop and resize images', category: 'Image Editor', url: '../image-editor/tools/crop-resize/index.html', tags: ['crop', 'resize', 'image', 'dimensions'] },
    { id: 'filters-effects', title: 'Filters & Effects', description: 'Apply filters and effects to images', category: 'Image Editor', url: '../image-editor/tools/filters-effects/index.html', tags: ['filters', 'effects', 'image', 'adjust'] },
    { id: 'rotate-flip', title: 'Rotate & Flip', description: 'Rotate and flip images', category: 'Image Editor', url: '../image-editor/tools/rotate-flip/index.html', tags: ['rotate', 'flip', 'image', 'orientation'] },
    { id: 'compress-image', title: 'Compress Image', description: 'Reduce image file size', category: 'Image Editor', url: '../image-editor/tools/compress-image/index.html', tags: ['image', 'compress', 'reduce', 'size'] },
    { id: 'add-text', title: 'Add Text to Image', description: 'Write text on images', category: 'Image Editor', url: '../image-editor/tools/add-text/index.html', tags: ['text', 'image', 'write', 'overlay'] },
    { id: 'add-border', title: 'Add Border / Frame', description: 'Add borders and frames to images', category: 'Image Editor', url: '../image-editor/tools/add-border/index.html', tags: ['border', 'frame', 'image', 'decorative'] },
    { id: 'round-crop', title: 'Round / Circle Crop', description: 'Crop images into circles', category: 'Image Editor', url: '../image-editor/tools/round-crop/index.html', tags: ['round', 'circle', 'crop', 'avatar'] },
    { id: 'combine-images', title: 'Combine Images', description: 'Merge multiple images into collages', category: 'Image Editor', url: '../image-editor/tools/combine-images/index.html', tags: ['combine', 'merge', 'collage', 'images'] },
    { id: 'add-watermark', title: 'Add Watermark', description: 'Add watermarks to images', category: 'Image Editor', url: '../image-editor/tools/add-watermark/index.html', tags: ['watermark', 'protect', 'image', 'overlay'] },
    { id: 'filter-adder', title: 'Filter Adder', description: 'Create custom color filters', category: 'Image Editor', url: '../image-editor/tools/filter-adder/index.html', tags: ['filter', 'color', 'matrix', 'custom'] },
    { id: 'ocr-extract', title: 'Image to Text (OCR)', description: 'Extract text from images', category: 'Image Editor', url: '../image-editor/tools/ocr-extract/index.html', tags: ['ocr', 'text', 'extract', 'image', 'scan'] },
    { id: 'bg-remover', title: 'Background Remover', description: 'Remove image backgrounds', category: 'Image Editor', url: '../image-editor/tools/bg-remover/index.html', tags: ['background', 'remove', 'image', 'transparent'] },
    { id: 'image-upscaler', title: 'Image Upscaler', description: 'Upscale images to higher resolution', category: 'Image Editor', url: '../image-editor/tools/image-upscaler/index.html', tags: ['upscale', 'resolution', 'enlarge', 'image'] },
    
    // Media Converter tools
    { id: 'video-to-audio', title: 'Video to Audio', description: 'Extract audio from video', category: 'Media Converter', url: '../media-converter/tools/video-to-audio/index.html', tags: ['video', 'audio', 'extract', 'convert'] },
    { id: 'multiply-audio', title: 'Multiply Audio', description: 'Multiply audio with loops and overlays', category: 'Media Converter', url: '../media-converter/tools/multiply-audio/index.html', tags: ['audio', 'loop', 'multiply', 'overlay', 'repeat'] },
    { id: 'audio-manipulator', title: 'Audio Manipulator', description: 'Adjust speed, pitch, volume, and audio effects', category: 'Media Converter', url: '../media-converter/tools/audio-manipulator/index.html', tags: ['audio', 'speed', 'pitch', 'volume', 'reverse', 'fade'] },
    { id: 'audio-to-text', title: 'Audio to Text', description: 'Transcribe audio to text', category: 'Media Converter', url: '../media-converter/tools/audio-to-text/index.html', tags: ['audio', 'text', 'transcribe', 'speech'] },
    { id: 'vocal-splitter', title: 'Vocal Splitter', description: 'Separate vocals from instrumentals', category: 'Media Converter', url: '../media-converter/tools/vocal-splitter/index.html', tags: ['vocal', 'split', 'separate', 'instrumental'] },
    { id: 'instrumental-extractor', title: 'Instrumental Extractor', description: 'Extract clean instrumental and backing tracks', category: 'Media Converter', url: '../media-converter/tools/instrumental-extractor/index.html', tags: ['instrumental', 'music', 'karaoke', 'vocals', 'extract'] },
    { id: 'compress-video', title: 'Compress Video', description: 'Reduce video file size', category: 'Media Converter', url: '../media-converter/tools/compress-video/index.html', tags: ['video', 'compress', 'reduce', 'size'] },
    { id: 'video-converter', title: 'Video Converter', description: 'Convert between video formats', category: 'Media Converter', url: '../media-converter/tools/video-converter/index.html', tags: ['video', 'convert', 'format', 'mp4', 'avi'] },
    { id: 'video-to-gif', title: 'Video to GIF', description: 'Convert video clips to animated GIFs and vice versa', category: 'Media Converter', url: '../media-converter/tools/video-to-gif/index.html', tags: ['video', 'gif', 'convert', 'animation'] },
    { id: 'social-downloader', title: 'Social Downloader', description: 'Download videos from social media', category: 'Media Converter', url: '../media-converter/tools/social-downloader/index.html', tags: ['social', 'download', 'video', 'facebook', 'youtube'] },
    
    // QR Generator tools
    { id: 'qr-to-url', title: 'QR to URL', description: 'Scan QR code to get URL', category: 'QR Generator', url: '../qr-generator/tools/qr-to-url/index.html', tags: ['qr', 'scan', 'url', 'decode'] },
    { id: 'url-to-qr', title: 'URL to QR', description: 'Generate QR code from URL', category: 'QR Generator', url: '../qr-generator/tools/url-to-qr/index.html', tags: ['qr', 'generate', 'url', 'code'] },
    { id: 'vcard-to-qr', title: 'vCard to QR', description: 'Generate QR code from contact info', category: 'QR Generator', url: '../qr-generator/tools/vcard-to-qr/index.html', tags: ['qr', 'vcard', 'contact', 'generate'] },
    { id: 'wifi-to-qr', title: 'WiFi to QR', description: 'Generate QR code for WiFi connection', category: 'QR Generator', url: '../qr-generator/tools/wifi-to-qr/index.html', tags: ['qr', 'wifi', 'password', 'generate'] },
  ];

  // Get tools for a specific category
  const getToolsByCategory = (category) => {
    return allTools.filter(tool => tool.category === category);
  };

  return {
    allTools,
    getToolsByCategory
  };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToolSearch;
}
