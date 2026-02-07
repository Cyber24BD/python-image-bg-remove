/**
 * Toamun BG Remove - Optimized JavaScript
 */
(function () {
    'use strict';

    const $ = id => document.getElementById(id);

    // UI Elements
    const el = {
        // Tabs
        tabSingle: $('tab-single'),
        tabBatch: $('tab-batch'),
        viewSingle: $('view-single'),
        viewBatch: $('view-batch'),

        // Engine
        withoutbg: $('engine-withoutbg'),
        rembg: $('engine-rembg'),

        // Single
        zone: $('upload-zone'),
        input: $('file-input'),
        placeholder: $('upload-placeholder'),
        processing: $('processing-state'),
        result: $('result-section'),
        error: $('error-state'),
        errorMsg: $('error-message'),
        original: $('original-image'),
        resultImg: $('result-image'),
        downloadBtn: $('download-btn'),
        newBtn: $('new-image-btn'),

        // Batch
        batchZone: $('batch-upload-zone'),
        batchInput: $('batch-file-input'),
        batchList: $('batch-file-list'),
        batchListHeader: $('batch-list-header'),
        batchCountBadge: $('batch-count-badge'),
        batchActions: $('batch-actions'),
        batchStatus: $('batch-status'),
        batchProcessBtn: $('batch-process-btn'),
        batchClearBtn: $('batch-clear-btn'),
        batchDownloadBtn: $('batch-download-btn'),
        batchProgressBar: $('batch-progress-bar'),
        batchProgressBarContainer: $('batch-progress-bar-container'),

        // Editor
        editLoading: $('edit-loading'),
        colorBtns: document.querySelectorAll('.color-btn'),
        colorPicker: $('bg-color-picker'),
        bgBtn: $('upload-bg-btn'),
        bgInput: $('bg-file-input'),
    };

    let engine = 'withoutbg';
    let filename = null;
    let originalFilename = null;
    let batchQueue = [];
    let processedFiles = [];
    let isBatchProcessing = false;

    // --- Init Handlers ---

    // Tabs
    el.tabSingle.onclick = () => switchTab('single');
    el.tabBatch.onclick = () => switchTab('batch');

    // Single Upload
    setupUploadZone(el.zone, el.input, process);

    // Batch Upload
    setupUploadZone(el.batchZone, el.batchInput, handleBatchSelect);
    el.batchProcessBtn.onclick = processBatchQueue;
    el.batchClearBtn.onclick = clearBatch;
    el.batchDownloadBtn.onclick = downloadBatchZip;

    // Global Engine Handlers
    el.withoutbg.onclick = () => setEngine('withoutbg');
    el.rembg.onclick = () => setEngine('rembg');

    // Editor Handlers
    el.downloadBtn.onclick = () => filename && (location.href = `/api/download/${filename}/`);
    el.newBtn.onclick = reset;
    el.colorBtns.forEach(btn => btn.onclick = () => updateComposite(btn.dataset.color));
    el.colorPicker.oninput = e => updateComposite(e.target.value);
    el.bgBtn.onclick = () => el.bgInput.click();
    el.bgInput.onchange = e => e.target.files[0] && updateComposite(null, e.target.files[0]);

    // Cleanup & Load Events
    el.original.onload = () => el.original.classList.add('loaded');
    el.resultImg.onload = () => el.resultImg.classList.add('loaded');

    // Clipboard Paste
    document.addEventListener('paste', e => {
        const file = e.clipboardData.files[0];
        if (file && file.type.startsWith('image/')) {
            if (!el.viewBatch.classList.contains('hidden')) {
                // In batch mode
                handleBatchSelect([file]);
            } else {
                // In single mode
                process(file);
            }
        }
    });

    // --- Core Functions ---

    function switchTab(tab) {
        if (tab === 'single') {
            el.tabSingle.classList.replace('text-gray-500', 'bg-white');
            el.tabSingle.classList.add('text-gray-900', 'shadow-sm');
            el.tabBatch.classList.remove('bg-white', 'text-gray-900', 'shadow-sm');
            el.tabBatch.classList.add('text-gray-500');
            el.viewSingle.classList.remove('hidden');
            el.viewBatch.classList.add('hidden');
        } else {
            el.tabBatch.classList.replace('text-gray-500', 'bg-white');
            el.tabBatch.classList.add('text-gray-900', 'shadow-sm');
            el.tabSingle.classList.remove('bg-white', 'text-gray-900', 'shadow-sm');
            el.tabSingle.classList.add('text-gray-500');
            el.viewBatch.classList.remove('hidden');
            el.viewSingle.classList.add('hidden');
        }
    }

    function setupUploadZone(zone, input, callback) {
        zone.onclick = () => input.click();
        input.onchange = e => {
            const files = Array.from(e.target.files);
            if (files.length) callback(files.length === 1 ? files[0] : files);
            input.value = '';
        };
        zone.ondragover = e => { e.preventDefault(); zone.classList.add('drag-over'); };
        zone.ondragleave = () => zone.classList.remove('drag-over');
        zone.ondrop = e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            if (files.length) callback(files.length === 1 ? files[0] : files);
        };
    }

    function setEngine(e) {
        if (isBatchProcessing) return; // Prevent changing engine during batch
        engine = e;
        el.withoutbg.classList.toggle('active', e === 'withoutbg');
        el.rembg.classList.toggle('active', e === 'rembg');
    }

    // --- Single Processing ---

    async function process(file) {
        if (!validFile(file)) return showError('Invalid file type.');

        el.placeholder.classList.add('hidden');
        el.processing.classList.remove('hidden');
        el.result.classList.add('hidden');
        el.error.classList.add('hidden');

        try {
            const data = await uploadFile(file);
            filename = data.filename;
            originalFilename = data.filename;

            el.original.src = data.original_url;
            el.resultImg.src = data.result_url;
            el.original.classList.remove('loaded');
            el.resultImg.classList.remove('loaded');

            el.processing.classList.add('hidden');
            el.zone.classList.add('hidden'); // Hide empty upload zone
            el.result.classList.remove('hidden');
        } catch (e) {
            showError(e.message);
        }
    }

    async function updateComposite(color, bgFile) {
        if (!originalFilename) return;
        el.editLoading.classList.remove('hidden');

        const form = new FormData();
        form.append('filename', originalFilename);
        if (color) form.append('color', color);
        if (bgFile) form.append('bg_image', bgFile);

        try {
            const res = await fetch('/api/composite/', { method: 'POST', body: form });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Failed');

            filename = data.filename;
            el.resultImg.src = data.result_url;
        } catch (e) {
            showError(e.message);
        } finally {
            el.editLoading.classList.add('hidden');
        }
    }

    // --- Batch Processing ---

    function handleBatchSelect(files) {
        const newFiles = Array.isArray(files) ? files : [files];
        const validFiles = newFiles.filter(validFile);

        if (validFiles.length === 0) return;

        validFiles.forEach(file => {
            const id = Math.random().toString(36).substr(2, 9);
            batchQueue.push({ id, file, status: 'pending' });
        });

        renderBatchList();
    }

    function renderBatchList() {
        if (batchQueue.length > 0) {
            el.batchList.classList.remove('hidden');
            el.batchListHeader.classList.remove('hidden');
            el.batchActions.classList.remove('hidden');
            el.batchZone.classList.add('hidden');
        } else {
            el.batchList.classList.add('hidden');
            el.batchListHeader.classList.add('hidden');
            el.batchActions.classList.add('hidden');
            el.batchZone.classList.remove('hidden');
        }

        el.batchCountBadge.textContent = batchQueue.length;
        el.batchStatus.textContent = `${batchQueue.length} files in queue`;

        el.batchList.innerHTML = batchQueue.map(item => `
            <div class="batch-item flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-sm" id="item-${item.id}">
                <div class="flex items-center gap-4">
                    <div class="status-indicator w-3 h-3 rounded-full ${getStatusColor(item.status)}"></div>
                    <div>
                        <p class="text-sm font-bold text-gray-900 truncate max-w-[240px]">${item.file.name}</p>
                        <p class="text-xs text-gray-500 uppercase font-medium">${(item.file.size / 1024).toFixed(0)} KB • ${item.status}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    ${item.status === 'done' ? `
                        <span class="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                            SUCCESS
                        </span>
                    ` : item.status === 'error' ? `
                        <span class="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            FAILED
                        </span>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    async function processBatchQueue() {
        if (isBatchProcessing || batchQueue.length === 0) return;

        isBatchProcessing = true;
        el.batchProcessBtn.disabled = true;
        el.batchProcessBtn.innerHTML = `
            <svg class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
        `;
        el.batchProgressBarContainer.classList.remove('hidden');
        el.batchClearBtn.classList.add('hidden');

        processedFiles = [];
        let completedCount = 0;

        for (const item of batchQueue) {
            if (item.status === 'done') {
                completedCount++;
                continue;
            }

            updateBatchItemStatus(item.id, 'processing');

            try {
                const data = await uploadFile(item.file);
                item.status = 'done';
                item.resultFilename = data.filename;
                processedFiles.push(data.filename);
                updateBatchItemStatus(item.id, 'done');
            } catch (e) {
                item.status = 'error';
                updateBatchItemStatus(item.id, 'error');
            }

            completedCount++;
            const progress = (completedCount / batchQueue.length) * 100;
            el.batchProgressBar.style.width = `${progress}%`;
            el.batchStatus.textContent = `Processed ${completedCount}/${batchQueue.length} files`;
        }

        isBatchProcessing = false;
        el.batchProcessBtn.innerHTML = `
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Batch Completed
        `;
        el.batchClearBtn.classList.remove('hidden');

        if (processedFiles.length > 0) {
            el.batchDownloadBtn.classList.remove('hidden');
        }
    }

    function updateBatchItemStatus(id, status) {
        const item = batchQueue.find(i => i.id === id);
        if (item) item.status = status;

        const elItem = $(`item-${id}`);
        if (elItem) {
            const indicator = elItem.querySelector('.status-indicator');
            const subtext = elItem.querySelector('.text-gray-500');
            const actions = elItem.querySelector('.flex.items-center.gap-2');

            if (indicator) indicator.className = `status-indicator w-3 h-3 rounded-full ${getStatusColor(status)}`;
            if (subtext) subtext.textContent = `${(item.file.size / 1024).toFixed(0)} KB • ${status}`;

            if (status === 'done') {
                actions.innerHTML = `
                    <span class="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        SUCCESS
                    </span>
                `;
            } else if (status === 'error') {
                actions.innerHTML = `
                    <span class="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        FAILED
                    </span>
                `;
            }
        }
    }

    function getStatusColor(status) {
        if (status === 'pending') return 'bg-gray-300';
        if (status === 'processing') return 'bg-blue-500 animate-pulse';
        if (status === 'done') return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]';
        if (status === 'error') return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
        return 'bg-gray-300';
    }

    async function downloadBatchZip() {
        if (processedFiles.length === 0) return;

        el.batchDownloadBtn.disabled = true;
        const originalText = el.batchDownloadBtn.innerHTML;
        el.batchDownloadBtn.innerHTML = '<span class="animate-pulse">Preparing ZIP...</span>';

        try {
            const res = await fetch('/api/batch-zip/', {
                method: 'POST',
                body: JSON.stringify({ filenames: processedFiles })
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `toamun-batch-${new Date().getTime()}.zip`;
                a.click();
            }
        } catch (e) {
            console.error(e);
        } finally {
            el.batchDownloadBtn.disabled = false;
            el.batchDownloadBtn.innerHTML = originalText;
        }
    }

    function clearBatch() {
        if (isBatchProcessing) return;
        batchQueue = [];
        processedFiles = [];
        renderBatchList();
        el.batchProcessBtn.disabled = false;
        el.batchProcessBtn.innerHTML = `
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Batch Processing
        `;
        el.batchDownloadBtn.classList.add('hidden');
        el.batchProgressBarContainer.classList.add('hidden');
        el.batchProgressBar.style.width = '0%';
    }

    // --- Helpers ---

    async function uploadFile(file) {
        const form = new FormData();
        form.append('image', file);
        form.append('engine', engine);

        const res = await fetch('/api/upload/', { method: 'POST', body: form });
        const data = await res.json();

        if (!res.ok || data.error) throw new Error(data.error || 'Failed');
        return data;
    }

    function validFile(file) {
        return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    }

    function showError(msg) {
        el.placeholder.classList.remove('hidden');
        el.processing.classList.add('hidden');
        el.errorMsg.textContent = msg;
        el.error.classList.remove('hidden');
    }

    function reset() {
        filename = null;
        originalFilename = null;
        el.input.value = '';
        el.original.src = '';
        el.resultImg.src = '';
        el.original.classList.remove('loaded');
        el.resultImg.classList.remove('loaded');
        el.placeholder.classList.remove('hidden');
        el.processing.classList.add('hidden');
        el.zone.classList.remove('hidden'); // Show upload zone again
        el.result.classList.add('hidden');
        el.error.classList.add('hidden');
    }
})();
