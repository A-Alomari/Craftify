/**
 * Image upload preview functionality
 * Shows thumbnails of selected images before upload
 */

(function() {
  'use strict';

  /**
   * Initialize image upload previews
   */
  function initImagePreviews() {
    const fileInputs = document.querySelectorAll('input[type="file"][accept*="image"]');
    
    fileInputs.forEach(function(input) {
      input.addEventListener('change', function(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        // Find or create preview container
        let previewContainer = input.parentNode.querySelector('.image-preview-container');
        if (!previewContainer) {
          previewContainer = document.createElement('div');
          previewContainer.className = 'image-preview-container mt-4 grid grid-cols-2 md:grid-cols-4 gap-3';
          input.parentNode.appendChild(previewContainer);
        }
        
        // Clear existing previews
        previewContainer.innerHTML = '';
        
        // Create previews for each selected file
        Array.from(files).forEach(function(file, index) {
          if (!file.type.startsWith('image/')) return;
          
          const reader = new FileReader();
          
          reader.onload = function(e) {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'relative group';
            
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'w-full h-32 object-cover rounded-lg border-2 border-outline-variant/20';
            img.alt = `Preview ${index + 1}`;
            
            const overlay = document.createElement('div');
            overlay.className = 'absolute inset-0 bg-black bg-opacity-40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center';
            
            const fileInfo = document.createElement('div');
            fileInfo.className = 'text-white text-xs text-center px-2';
            fileInfo.innerHTML = `
              <p class="font-semibold truncate">${file.name}</p>
              <p>${(file.size / 1024).toFixed(1)} KB</p>
            `;
            
            overlay.appendChild(fileInfo);
            previewDiv.appendChild(img);
            previewDiv.appendChild(overlay);
            previewContainer.appendChild(previewDiv);
          };
          
          reader.readAsDataURL(file);
        });
        
        // Show file count
        const fileCount = files.length;
        const countBadge = input.parentNode.querySelector('.file-count-badge');
        if (countBadge) {
          countBadge.textContent = `${fileCount} file${fileCount !== 1 ? 's' : ''} selected`;
        } else if (fileCount > 0) {
          const badge = document.createElement('p');
          badge.className = 'file-count-badge text-xs text-secondary mt-2';
          badge.textContent = `${fileCount} file${fileCount !== 1 ? 's' : ''} selected`;
          input.parentNode.insertBefore(badge, previewContainer);
        }
      });
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initImagePreviews);
  } else {
    initImagePreviews();
  }
})();
