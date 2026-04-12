/**
 * AgriIntel - History Page Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const historyTable = document.getElementById('historyTable');
    const filterCrop = document.getElementById('filterCrop');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');

    let currentRecords = [];

    // --- Load Data ---

    async function loadHistory() {
        console.log("Loading History...");
        try {
            const cropType = filterCrop.value;
            
            // 1. Fetch Online Records
            let onlineRecords = [];
            try {
                const res = await API.getHistory(cropType);
                onlineRecords = Array.isArray(res) ? res : [];
                console.log("Online Records Loaded:", onlineRecords.length);
            } catch (e) {
                console.warn("Could not fetch online records, showing local only.", e);
            }

            // 2. Fetch Offline Sync Records (IndexedDB)
            let offlineSyncRecords = [];
            try {
                const db = await initDB();
                const tx = db.transaction('offline_records', 'readonly');
                const store = tx.objectStore('offline_records');
                const request = store.getAll();
                offlineSyncRecords = await new Promise((resolve) => {
                    request.onsuccess = () => {
                        const results = request.result || [];
                        resolve(results.map(item => ({ 
                            ...item.record, 
                            created_at: item.timestamp,
                            is_offline: true 
                        })));
                    };
                    request.onerror = () => resolve([]);
                });
                console.log("Offline Sync Records Loaded:", offlineSyncRecords.length);
            } catch (e) {
                console.warn("Could not fetch offline sync records.", e);
            }

            // 3. Fetch Personal History (LocalStorage)
            let localHistory = [];
            try {
                localHistory = JSON.parse(localStorage.getItem('agriintel_history') || '[]');
                localHistory = localHistory.map(r => ({ ...r, is_local: true }));
                console.log("Local History Loaded:", localHistory.length);
            } catch (e) {
                console.warn("Could not fetch local history.", e);
            }

            // 4. Merge and Filter
            const seenBatchIds = new Set();
            let merged = [];

            [...offlineSyncRecords, ...onlineRecords, ...localHistory].forEach(record => {
                if (record && record.batch_id && !seenBatchIds.has(record.batch_id)) {
                    if (!cropType || record.crop_type === cropType) {
                        merged.push(record);
                        seenBatchIds.add(record.batch_id);
                    }
                }
            });

            merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            console.log("Total Merged Records:", merged.length);
            currentRecords = merged;
            renderTable(merged);
            lucide.createIcons();
        } catch (error) {
            console.error("Load History Error:", error);
            historyTable.innerHTML = `<tr><td colspan="7" class="text-center" style="color: var(--danger); padding: 2rem;">Error loading history: ${error.message}</td></tr>`;
        }
    }

    function renderTable(records) {
        if (records.length === 0) {
            historyTable.innerHTML = '<tr><td colspan="7" class="text-center">Walang records na nahanap.</td></tr>';
            return;
        }

        historyTable.innerHTML = records.map(record => {
            const date = new Date(record.created_at).toLocaleDateString('en-PH', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const gradeClass = record.grade === 'A' ? 'badge-a' : record.grade === 'B' ? 'badge-b' : 'badge-c';
            
            let statusBadge = '';
            if (record.is_offline) {
                statusBadge = '<span class="tag-mini" style="background: #FFE0B2; color: #E65100;">Syncing...</span>';
            } else if (record.is_local) {
                statusBadge = '<span class="tag-mini" style="background: #E1F5FE; color: #01579B;">Local</span>';
            }

            return `
                <tr>
                    <td>
                        <div style="font-weight: bold;">${record.crop_type} ${statusBadge}</div>
                        <div style="font-size: 0.65rem; color: #888;">${record.batch_id || 'N/A'}</div>
                    </td>
                    <td><img src="${record.photo_url}" class="thumb" alt="Crop" onerror="this.src='https://picsum.photos/seed/crop/100/100'"></td>
                    <td><span class="badge-small ${gradeClass}">${record.grade}</span></td>
                    <td>${date}</td>
                    <td>
                        <div style="font-size: 0.75rem;">
                            ${[record.country, record.region, record.province, record.city, record.location_barangay].filter(Boolean).join(' > ')}
                        </div>
                    </td>
                    <td>
                        <div style="font-size: 0.75rem;">
                            C:${record.color_score||'-'} S:${record.size_score||'-'} D:${record.defects||'-'} T:${record.texture||'-'}
                        </div>
                    </td>
                    <td>
                        <div style="font-size: 0.75rem;">
                            N:${record.nutrient_n||'-'} P:${record.nutrient_p||'-'} K:${record.nutrient_k||'-'}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // --- Offline DB Logic ---
    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AgriIntelDB', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('offline_records')) {
                    db.createObjectStore('offline_records', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    // --- Filter ---

    filterCrop.addEventListener('change', loadHistory);

    // --- Export Data ---

    exportCsvBtn.addEventListener('click', () => {
        if (currentRecords.length === 0) {
            alert('No records to export.');
            return;
        }

        const headers = ['Batch ID', 'Date', 'Crop Type', 'Grade', 'Confidence', 'Country', 'Region', 'Province', 'City', 'Barangay', 'Address', 'Latitude', 'Longitude', 'Color', 'Size', 'Defects', 'Texture', 'Nutrient N', 'Nutrient P', 'Nutrient K', 'Grader', 'Price Range', 'Photo URL'];
        const rows = currentRecords.map(r => [
            r.batch_id || '',
            new Date(r.created_at).toISOString(),
            r.crop_type,
            r.grade,
            r.confidence + '%',
            r.country || '',
            r.region || '',
            r.province || '',
            r.city || '',
            r.location_barangay || '',
            r.address || '',
            r.latitude || '',
            r.longitude || '',
            r.color_score || '',
            r.size_score || '',
            r.defects || '',
            r.texture || '',
            r.nutrient_n || '',
            r.nutrient_p || '',
            r.nutrient_k || '',
            r.grader_name || '',
            r.suggested_price_range,
            r.photo_url
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `AgriIntel_Export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    exportJsonBtn.addEventListener('click', () => {
        if (currentRecords.length === 0) {
            alert('No records to export.');
            return;
        }

        const jsonContent = JSON.stringify(currentRecords, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `AgriIntel_Export_${new Date().toISOString().split('T')[0]}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Initial Load
    loadHistory();
    lucide.createIcons();
});
