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
        withoutbg: $('engine-withoutbg'),
        rembg: $('engine-rembg'),

        // Batch
        batchZone: $('batch-upload-zone'),
        batchInput: $('batch-file-input'),
        batchList: $('batch-file-list'),
        batchActions: $('batch-actions'),
        batchStatus: $('batch-status'),
        batchProcessBtn: $('batch-process-btn'),
        batchClearBtn: $('batch-clear-btn'),
        batchDownloadBtn: $('batch-download-btn'),

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

    // Editor Handlers
    el.withoutbg.onclick = () => setEngine('withoutbg');
    el.rembg.onclick = () => setEngine('rembg');
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
            if (el.viewSingle.classList.contains('hidden')) {
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
            el.batchActions.classList.remove('hidden');
            el.batchZone.classList.add('hidden');
        } else {
            el.batchList.classList.add('hidden');
            el.batchActions.classList.add('hidden');
            el.batchZone.classList.remove('hidden');
        }

        el.batchStatus.textContent = `${batchQueue.length} files`;

        el.batchList.innerHTML = batchQueue.map(item => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100" id="item-${item.id}">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full ${getStatusColor(item.status)}"></div>
                    <span class="text-sm font-medium text-gray-700 truncate max-w-[200px]">${item.file.name}</span>
                    <span class="text-xs text-gray-400">(${(item.file.size / 1024).toFixed(0)} KB)</span>
                </div>
                ${item.status === 'done' ?
                '<span class="text-xs font-bold text-green-600">DONE</span>' :
                item.status === 'error' ?
                    '<span class="text-xs font-bold text-red-600">ERROR</span>' : ''}
            </div>
        `).join('');
    }

    async function processBatchQueue() {
        el.batchProcessBtn.disabled = true;
        el.batchProcessBtn.textContent = 'Processing...';

        processedFiles = [];

        for (const item of batchQueue) {
            if (item.status === 'done') continue;

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
        }

        el.batchProcessBtn.textContent = 'Completed';
        if (processedFiles.length > 0) {
            el.batchDownloadBtn.classList.remove('hidden');
        }
    }

    function updateBatchItemStatus(id, status) {
        const indicator = document.querySelector(`#item-${id} .w-2`);
        if (indicator) {
            indicator.className = `w-2 h-2 rounded-full ${getStatusColor(status)}`;
        }
    }

    function getStatusColor(status) {
        if (status === 'pending') return 'bg-gray-300';
        if (status === 'processing') return 'bg-blue-500 animate-pulse';
        if (status === 'done') return 'bg-green-500';
        if (status === 'error') return 'bg-red-500';
        return 'bg-gray-300';
    }

    async function downloadBatchZip() {
        if (processedFiles.length === 0) return;

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
                a.download = 'toamun-batch-results.zip';
                a.click();
            }
        } catch (e) {
            console.error(e);
        }
    }

    function clearBatch() {
        batchQueue = [];
        processedFiles = [];
        renderBatchList();
        el.batchProcessBtn.disabled = false;
        el.batchProcessBtn.textContent = 'Start Processing';
        el.batchDownloadBtn.classList.add('hidden');
    }

    // --- Helpers ---

    async function uploadFile(file) {
        const form = new FormData();
        form.append('image', file);
        form.append('engine', engine); // Use current selected engine for batch too

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
