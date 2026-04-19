/**
 * Craftify — Image crop + slot management
 *
 * Two entry points:
 *   initImageSlots()  – 5-slot grid on product-form and auction-form pages.
 *                       Handles add / replace / delete per slot with crop modal.
 *   init()            – Generic crop-on-upload for other image inputs (profile photo).
 */
(function () {
  'use strict';

  // ─── Crop-modal state ──────────────────────────────────────────────────────
  var modal         = null;
  var cropCanvas    = null;
  var ctx           = null;
  var currentImg    = null;
  var crop          = { x: 0, y: 0, w: 0, h: 0 };
  var drag          = null;
  var currentAspect = null;
  var resolveFunc   = null;
  var raf           = null;

  // ─── Build modal (once) ────────────────────────────────────────────────────
  function buildModal() {
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'craftify-crop-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Crop image');
    modal.style.cssText = [
      'display:none', 'position:fixed', 'inset:0', 'z-index:10000',
      'background:rgba(0,0,0,0.88)', 'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'padding:12px', 'box-sizing:border-box'
    ].join(';');

    modal.innerHTML = [
      '<div style="background:#18181b;border-radius:18px;max-width:720px;width:100%;',
        'max-height:94dvh;display:flex;flex-direction:column;overflow:hidden;',
        'box-shadow:0 32px 80px rgba(0,0,0,.6);">',
        '<div style="padding:14px 18px;border-bottom:1px solid #2f2f33;',
          'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">',
          '<span style="color:#fff;font-weight:700;font-size:14px;letter-spacing:.06em;',
            'display:flex;align-items:center;gap:6px;">',
            '<span style="font-size:18px;">✂</span> Crop Image',
          '</span>',
          '<div style="display:flex;gap:6px;flex-wrap:wrap;" id="crop-aspect-btns">',
            '<button data-ratio="" id="crop-btn-free"  class="crop-ratio-btn">Free</button>',
            '<button data-ratio="1"    id="crop-btn-11"  class="crop-ratio-btn">1 : 1</button>',
            '<button data-ratio="0.8"  id="crop-btn-45"  class="crop-ratio-btn">4 : 5</button>',
            '<button data-ratio="1.778" id="crop-btn-169" class="crop-ratio-btn">16 : 9</button>',
          '</div>',
        '</div>',
        '<div style="flex:1;overflow:hidden;min-height:0;background:#111;',
          'display:flex;align-items:center;justify-content:center;padding:8px;">',
          '<canvas id="crop-canvas" style="max-width:100%;max-height:100%;',
            'display:block;cursor:crosshair;touch-action:none;"></canvas>',
        '</div>',
        '<div style="padding:12px 18px;border-top:1px solid #2f2f33;',
          'display:flex;align-items:center;justify-content:space-between;gap:10px;">',
          '<span id="crop-hint" style="color:#71717a;font-size:12px;">',
            'Drag to reposition · Handles to resize',
          '</span>',
          '<div style="display:flex;gap:10px;">',
            '<button id="crop-btn-skip" style="padding:8px 18px;border-radius:10px;',
              'border:1px solid #3f3f46;background:transparent;color:#a1a1aa;',
              'font-size:13px;cursor:pointer;font-family:inherit;">Skip</button>',
            '<button id="crop-btn-apply" style="padding:8px 22px;border-radius:10px;',
              'border:none;background:#d97706;color:#fff;font-weight:700;',
              'font-size:13px;cursor:pointer;font-family:inherit;">Crop &amp; Use</button>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');

    var style = document.createElement('style');
    style.textContent = [
      '.crop-ratio-btn{padding:4px 11px;border-radius:7px;border:1px solid #3f3f46;',
        'background:transparent;color:#a1a1aa;font-size:11px;cursor:pointer;',
        'font-family:inherit;transition:background .15s,color .15s;}',
      '.crop-ratio-btn.active{background:#3f3f46;color:#fff;border-color:#52525b;}'
    ].join('');
    document.head.appendChild(style);
    document.body.appendChild(modal);

    cropCanvas = modal.querySelector('#crop-canvas');
    ctx        = cropCanvas.getContext('2d');

    modal.querySelector('#crop-aspect-btns').addEventListener('click', function (e) {
      var btn = e.target.closest('.crop-ratio-btn');
      if (!btn) return;
      var ratio = btn.dataset.ratio === '' ? null : parseFloat(btn.dataset.ratio);
      applyAspect(ratio);
      modal.querySelectorAll('.crop-ratio-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
    modal.querySelector('#crop-btn-free').classList.add('active');
    modal.querySelector('#crop-btn-apply').addEventListener('click', applyCurrentCrop);
    modal.querySelector('#crop-btn-skip').addEventListener('click', skipCurrentCrop);

    document.addEventListener('keydown', function (e) {
      if (!modal || modal.style.display === 'none') return;
      if (e.key === 'Enter')  { e.preventDefault(); applyCurrentCrop(); }
      if (e.key === 'Escape') { e.preventDefault(); skipCurrentCrop(); }
    });

    cropCanvas.addEventListener('mousedown',  onPointerDown);
    cropCanvas.addEventListener('mousemove',  onPointerMove);
    cropCanvas.addEventListener('mouseup',    onPointerUp);
    cropCanvas.addEventListener('mouseleave', onPointerUp);
    cropCanvas.addEventListener('touchstart', onPointerDown, { passive: false });
    cropCanvas.addEventListener('touchmove',  onPointerMove, { passive: false });
    cropCanvas.addEventListener('touchend',   onPointerUp);
  }

  // ─── Aspect ratio ─────────────────────────────────────────────────────────
  function applyAspect(ratio) {
    currentAspect = ratio;
    if (ratio !== null && currentImg) {
      var cx = crop.x + crop.w / 2, cy = crop.y + crop.h / 2;
      var nw = crop.w, nh = nw / ratio;
      if (nh > cropCanvas.height) { nh = cropCanvas.height; nw = nh * ratio; }
      crop.x = cx - nw / 2; crop.y = cy - nh / 2;
      crop.w = nw; crop.h = nh;
      clampCrop(); scheduleRedraw();
    }
  }

  function setActiveAspectBtn(btnId) {
    if (!modal) return;
    modal.querySelectorAll('.crop-ratio-btn').forEach(function (b) { b.classList.remove('active'); });
    var btn = modal.querySelector('#' + btnId);
    if (btn) btn.classList.add('active');
  }

  // ─── Show modal for one file ───────────────────────────────────────────────
  function showCropForFile(file, index, total) {
    return new Promise(function (resolve) {
      resolveFunc = resolve;
      modal.style.display = 'flex';
      if (modal.querySelector('#crop-hint')) {
        modal.querySelector('#crop-hint').textContent =
          total > 1 ? 'Image ' + (index + 1) + ' of ' + total + ' · Drag to reposition · Handles to resize' :
                      'Drag to reposition · Handles to resize';
      }

      var objectURL = URL.createObjectURL(file);
      currentImg = new Image();
      currentImg.onload = function () {
        URL.revokeObjectURL(objectURL);
        var maxW = Math.min(660, window.innerWidth  - 48);
        var maxH = Math.min(480, window.innerHeight - 200);
        var scale = Math.min(maxW / currentImg.naturalWidth, maxH / currentImg.naturalHeight, 1);
        cropCanvas.width  = Math.round(currentImg.naturalWidth  * scale);
        cropCanvas.height = Math.round(currentImg.naturalHeight * scale);

        var cw = cropCanvas.width  * 0.85, ch = cropCanvas.height * 0.85;
        if (currentAspect) {
          ch = cw / currentAspect;
          if (ch > cropCanvas.height * 0.85) { ch = cropCanvas.height * 0.85; cw = ch * currentAspect; }
        }
        crop.x = (cropCanvas.width  - cw) / 2;
        crop.y = (cropCanvas.height - ch) / 2;
        crop.w = cw; crop.h = ch;
        scheduleRedraw();
      };
      currentImg.onerror = function () {
        URL.revokeObjectURL(objectURL);
        resolve({ blob: null, skipped: true });
      };
      currentImg.src = objectURL;
    });
  }

  // ─── Drawing ───────────────────────────────────────────────────────────────
  function scheduleRedraw() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(redraw);
  }

  function redraw() {
    raf = null;
    if (!currentImg || !ctx) return;
    var cw = cropCanvas.width, ch = cropCanvas.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(currentImg, 0, 0, cw, ch);

    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(0, 0, cw, crop.y);
    ctx.fillRect(0, crop.y + crop.h, cw, ch - crop.y - crop.h);
    ctx.fillRect(0, crop.y, crop.x, crop.h);
    ctx.fillRect(crop.x + crop.w, crop.y, cw - crop.x - crop.w, crop.h);

    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);

    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
    for (var i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(crop.x + (crop.w / 3) * i, crop.y);
      ctx.lineTo(crop.x + (crop.w / 3) * i, crop.y + crop.h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(crop.x, crop.y + (crop.h / 3) * i);
      ctx.lineTo(crop.x + crop.w, crop.y + (crop.h / 3) * i);
      ctx.stroke();
    }

    var hs = 10;
    ctx.fillStyle = '#f59e0b';
    [[crop.x, crop.y], [crop.x + crop.w - hs, crop.y],
     [crop.x, crop.y + crop.h - hs], [crop.x + crop.w - hs, crop.y + crop.h - hs]
    ].forEach(function (h) { ctx.fillRect(h[0], h[1], hs, hs); });
  }

  // ─── Pointer interaction ───────────────────────────────────────────────────
  function getXY(e) {
    var rect = cropCanvas.getBoundingClientRect();
    var sx = cropCanvas.width / rect.width, sy = cropCanvas.height / rect.height;
    var src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
  }

  var HS = 18;
  function hitZone(p) {
    var inX = p.x >= crop.x && p.x <= crop.x + crop.w;
    var inY = p.y >= crop.y && p.y <= crop.y + crop.h;
    var nL  = p.x <= crop.x + HS, nR = p.x >= crop.x + crop.w - HS;
    var nT  = p.y <= crop.y + HS, nB = p.y >= crop.y + crop.h - HS;
    if (inX && inY) {
      if (nL && nT) return 'nw'; if (nR && nT) return 'ne';
      if (nL && nB) return 'sw'; if (nR && nB) return 'se';
      return 'move';
    }
    return 'draw';
  }

  var CURSORS = { move:'move', nw:'nw-resize', ne:'ne-resize', sw:'sw-resize', se:'se-resize', draw:'crosshair' };

  function onPointerDown(e) {
    e.preventDefault();
    var p = getXY(e);
    drag = { type: hitZone(p), sx: p.x, sy: p.y, snap: { x: crop.x, y: crop.y, w: crop.w, h: crop.h } };
  }
  function onPointerMove(e) {
    e.preventDefault();
    var p = getXY(e);
    if (!drag) { cropCanvas.style.cursor = CURSORS[hitZone(p)] || 'crosshair'; return; }
    var dx = p.x - drag.sx, dy = p.y - drag.sy, s = drag.snap;
    switch (drag.type) {
      case 'move': crop.x = s.x + dx; crop.y = s.y + dy; break;
      case 'draw':
        crop.x = Math.min(drag.sx, p.x); crop.y = Math.min(drag.sy, p.y);
        crop.w = Math.max(20, Math.abs(p.x - drag.sx));
        crop.h = currentAspect ? crop.w / currentAspect : Math.max(20, Math.abs(p.y - drag.sy));
        break;
      case 'nw':
        crop.x = s.x + dx; crop.w = Math.max(20, s.w - dx);
        crop.y = s.y + dy; crop.h = currentAspect ? crop.w / currentAspect : Math.max(20, s.h - dy); break;
      case 'ne':
        crop.w = Math.max(20, s.w + dx);
        crop.y = s.y + dy; crop.h = currentAspect ? crop.w / currentAspect : Math.max(20, s.h - dy); break;
      case 'sw':
        crop.x = s.x + dx; crop.w = Math.max(20, s.w - dx);
        crop.h = currentAspect ? crop.w / currentAspect : Math.max(20, s.h + dy); break;
      case 'se':
        crop.w = Math.max(20, s.w + dx);
        crop.h = currentAspect ? crop.w / currentAspect : Math.max(20, s.h + dy); break;
    }
    clampCrop(); scheduleRedraw();
    cropCanvas.style.cursor = CURSORS[drag.type] || 'crosshair';
  }
  function onPointerUp() { drag = null; }
  function clampCrop() {
    crop.w = Math.max(20, Math.min(crop.w, cropCanvas.width));
    crop.h = Math.max(20, Math.min(crop.h, cropCanvas.height));
    crop.x = Math.max(0, Math.min(crop.x, cropCanvas.width  - crop.w));
    crop.y = Math.max(0, Math.min(crop.y, cropCanvas.height - crop.h));
  }

  // ─── Apply / Skip ──────────────────────────────────────────────────────────
  function applyCurrentCrop() {
    if (!currentImg || !resolveFunc) return;
    var sx = currentImg.naturalWidth / cropCanvas.width;
    var sy = currentImg.naturalHeight / cropCanvas.height;
    var off = document.createElement('canvas');
    off.width  = Math.round(crop.w * sx);
    off.height = Math.round(crop.h * sy);
    off.getContext('2d').drawImage(
      currentImg,
      crop.x * sx, crop.y * sy, crop.w * sx, crop.h * sy,
      0, 0, off.width, off.height
    );
    modal.style.display = 'none';
    var resolve = resolveFunc; resolveFunc = null;
    off.toBlob(function (blob) { resolve({ blob: blob, skipped: false }); }, 'image/jpeg', 0.92);
  }
  function skipCurrentCrop() {
    if (!resolveFunc) return;
    modal.style.display = 'none';
    var resolve = resolveFunc; resolveFunc = null;
    resolve({ blob: null, skipped: true });
  }

  // ─── Shared crop helper ───────────────────────────────────────────────────
  async function cropFile(file) {
    buildModal();
    var result = await showCropForFile(file, 0, 1);
    if (result.skipped || !result.blob) return file;
    return new File([result.blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  }

  // ─── Slot management ──────────────────────────────────────────────────────
  // slotFiles[0..4] holds the new File chosen by the user for each slot (null if none)
  var slotFiles    = [null, null, null, null, null];
  var targetSlot   = -1;

  function initImageSlots() {
    var slotGrid  = document.getElementById('image-slots');
    if (!slotGrid) return;
    var fileInput = document.getElementById('img-slot-input');
    if (!fileInput) return;

    // Delegate all interactions on the grid
    slotGrid.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (btn) {
        e.stopPropagation();
        var si = parseInt(btn.dataset.slot, 10);
        if (btn.dataset.action === 'replace') triggerSlotPicker(si, slotGrid, fileInput);
        if (btn.dataset.action === 'delete')  deleteSlot(si, slotGrid, fileInput);
        return;
      }
      var slot = e.target.closest('.image-slot');
      if (!slot) return;
      var si = parseInt(slot.dataset.slot, 10);
      // Only open picker for truly empty slots
      if (!slot.dataset.existing && !slotFiles[si]) {
        if (countFilled(slotGrid) >= 5) return; // max reached
        triggerSlotPicker(si, slotGrid, fileInput);
      }
    });

    // File chosen → crop → assign to slot
    fileInput.addEventListener('change', async function () {
      if (!fileInput.files.length || targetSlot < 0) return;
      var file = fileInput.files[0];
      fileInput.value = '';
      if (!file.type.startsWith('image/')) return;

      var final = await cropFile(file);

      var slot = slotGrid.querySelector('[data-slot="' + targetSlot + '"]');
      if (slot && slot.dataset.existing) {
        addDeleteInput(slot.dataset.existing);
        slot.dataset.existing = '';
      }

      slotFiles[targetSlot] = final;
      if (slot) renderFilledSlot(slot, targetSlot, final, slotGrid);

      rebuildFileInput(fileInput);
      refreshCoverBadges(slotGrid);
      updateCountLabel(slotGrid);
      updateLivePreview(slotGrid);
    });

    updateCountLabel(slotGrid);
    updateLivePreview(slotGrid); // set initial live-preview from existing images
  }

  function triggerSlotPicker(slotIdx, slotGrid, fileInput) {
    targetSlot = slotIdx;
    fileInput.value = '';
    fileInput.click();
  }

  function deleteSlot(slotIdx, slotGrid, fileInput) {
    var slot = slotGrid.querySelector('[data-slot="' + slotIdx + '"]');
    if (!slot) return;
    if (slot.dataset.existing) {
      addDeleteInput(slot.dataset.existing);
      slot.dataset.existing = '';
    }
    slotFiles[slotIdx] = null;
    renderEmptySlot(slot, slotIdx);
    rebuildFileInput(fileInput);
    refreshCoverBadges(slotGrid);
    updateCountLabel(slotGrid);
    updateLivePreview(slotGrid);
  }

  function addDeleteInput(url) {
    var c = document.getElementById('delete-inputs-container');
    if (!c || !url) return;
    if (c.querySelector('input[value="' + url.replace(/"/g, '\\"') + '"]')) return;
    var inp = document.createElement('input');
    inp.type = 'hidden'; inp.name = 'delete_images'; inp.value = url;
    c.appendChild(inp);
  }

  function renderFilledSlot(slot, slotIdx, file, slotGrid) {
    readURL(file, function (src) {
      slot.className = 'image-slot aspect-square rounded-xl overflow-hidden relative group cursor-pointer';
      slot.innerHTML = [
        '<img src="', src, '" alt="Image ', (slotIdx + 1), '"',
          ' class="w-full h-full object-cover pointer-events-none">',
        '<div class="slot-overlay absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100',
          ' transition-all flex flex-col items-center justify-center gap-2">',
          slotBtn('replace', slotIdx, 'swap_horiz', 'bg-white/90 text-slate-800 hover:bg-white', 'Replace'),
          slotBtn('delete',  slotIdx, 'delete',     'bg-red-500/90 text-white hover:bg-red-500',  'Delete'),
        '</div>'
      ].join('');
    });
  }

  function renderEmptySlot(slot) {
    slot.className = [
      'image-slot aspect-square rounded-xl border-2 border-dashed border-outline-variant',
      'flex flex-col items-center justify-center text-secondary',
      'hover:border-primary hover:text-primary hover:bg-surface-container-low',
      'transition-all cursor-pointer bg-surface-container-lowest'
    ].join(' ');
    slot.dataset.existing = '';
    slot.innerHTML = [
      '<span class="material-symbols-outlined text-2xl">add_photo_alternate</span>',
      '<span class="text-[11px] font-semibold mt-1">Add Image</span>'
    ].join('');
  }

  function slotBtn(action, slotIdx, icon, colorCls, label) {
    return [
      '<button type="button" data-action="', action, '" data-slot="', slotIdx, '"',
        ' class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold',
        ' transition-colors ', colorCls, '">',
        '<span class="material-symbols-outlined text-sm">', icon, '</span> ', label,
      '</button>'
    ].join('');
  }

  function refreshCoverBadges(slotGrid) {
    var slots = Array.from(slotGrid.querySelectorAll('.image-slot'));
    // Find first filled slot index
    var firstFilled = -1;
    for (var i = 0; i < slots.length; i++) {
      var si = parseInt(slots[i].dataset.slot, 10);
      if (slots[i].dataset.existing || slotFiles[si]) { firstFilled = si; break; }
    }
    slots.forEach(function (slot) {
      // Remove old badge
      var old = slot.querySelector('.cover-badge');
      if (old) old.remove();
      var si = parseInt(slot.dataset.slot, 10);
      if (si !== firstFilled) return;
      var img = slot.querySelector('img');
      if (!img) return;
      var b = document.createElement('div');
      b.className = 'cover-badge absolute top-2 left-2 pointer-events-none';
      b.innerHTML = '<span class="bg-primary-container text-on-primary-container text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">COVER</span>';
      slot.appendChild(b);
    });
  }

  function countFilled(slotGrid) {
    var n = 0;
    slotGrid.querySelectorAll('.image-slot').forEach(function (slot) {
      var si = parseInt(slot.dataset.slot, 10);
      if (slot.dataset.existing || slotFiles[si]) n++;
    });
    return n;
  }

  function updateCountLabel(slotGrid) {
    var label = document.getElementById('img-count-label');
    if (label) label.textContent = countFilled(slotGrid) + ' / 5 images';
  }

  function rebuildFileInput(fileInput) {
    try {
      var dt = new DataTransfer();
      slotFiles.forEach(function (f) { if (f) dt.items.add(f); });
      fileInput.files = dt.files;
    } catch (_) {}
  }

  function updateLivePreview(slotGrid) {
    var wrap = document.getElementById('preview-img-wrap');
    if (!wrap) return;
    var slots = Array.from(slotGrid.querySelectorAll('.image-slot'));
    for (var i = 0; i < slots.length; i++) {
      var si = parseInt(slots[i].dataset.slot, 10);
      if (slotFiles[si]) {
        readURL(slotFiles[si], function (src) {
          wrap.innerHTML = '<img src="' + src + '" alt="Preview" class="w-full h-full object-cover" id="preview-img">';
        });
        return;
      }
      if (slots[i].dataset.existing) {
        wrap.innerHTML = '<img src="' + slots[i].dataset.existing + '" alt="Preview" class="w-full h-full object-cover" id="preview-img">';
        return;
      }
    }
    wrap.innerHTML = '<span class="material-symbols-outlined text-4xl text-outline">image</span>';
  }

  // ─── Generic handler (profile photo, etc.) ────────────────────────────────
  async function handleFileInput(input) {
    var files = Array.from(input.files || []);
    if (!files.length) return;

    // Profile images default to 1:1
    if (input.name === 'profile_image' || input.dataset.cropAspect === '1') {
      currentAspect = 1;
      buildModal();
      setActiveAspectBtn('crop-btn-11');
    } else {
      buildModal();
    }

    var croppedFiles = [];
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (!file.type.startsWith('image/')) { croppedFiles.push(file); continue; }
      var result = await showCropForFile(file, i, files.length);
      if (result.skipped || !result.blob) {
        croppedFiles.push(file);
      } else {
        croppedFiles.push(new File([result.blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }
    }

    try {
      var dt = new DataTransfer();
      croppedFiles.forEach(function (f) { dt.items.add(f); });
      input.files = dt.files;
    } catch (_) {}
  }

  // ─── Utility ──────────────────────────────────────────────────────────────
  function readURL(file, cb) {
    var r = new FileReader();
    r.onload = function (e) { cb(e.target.result); };
    r.readAsDataURL(file);
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    initImageSlots();

    // Generic crop for all other image inputs (e.g. profile photo)
    document.querySelectorAll('input[type="file"][accept*="image"]').forEach(function (input) {
      if (input.id === 'img-slot-input') return; // handled by initImageSlots
      input.addEventListener('change', function () { handleFileInput(input); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
