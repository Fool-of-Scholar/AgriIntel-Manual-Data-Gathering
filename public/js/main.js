/**
 * AgriIntel - Main Frontend Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const uploadBox = document.getElementById('uploadBox');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const previewContainer = document.getElementById('previewContainer');
    const uploadStatus = document.getElementById('uploadStatus');
    const fileInput = document.getElementById('fileInput');
    const previewImg = document.getElementById('previewImg');
    const gradeBtn = document.getElementById('gradeBtn');
    const manualGradeBtn = document.getElementById('manualGradeBtn');
    const cropTypeSelect = document.getElementById('cropType');
    const loading = document.getElementById('loading');
    const resultCard = document.getElementById('resultCard');
    const saveForm = document.getElementById('saveForm');
    const successMsg = document.getElementById('successMsg');
    
    // Passport Elements
    const batchIdBadge = document.getElementById('batchIdBadge');
    const locationBadge = document.getElementById('locationBadge');

    // Result Elements
    const gradeBadge = document.getElementById('gradeBadge');
    const actionTag = document.getElementById('actionTag');
    const confidenceLabel = document.getElementById('confidenceLabel');
    const confidenceBar = document.getElementById('confidenceBar');
    const explanation = document.getElementById('explanation');
    const observations = document.getElementById('observations');
    const priceText = document.getElementById('priceText');
    
    // Action Buttons
    const confirmBtn = document.getElementById('confirmBtn');
    const overrideBtn = document.getElementById('overrideBtn');
    const overridePanel = document.getElementById('overridePanel');
    const manualGradeSelect = document.getElementById('manualGrade');
    const overrideReason = document.getElementById('overrideReason');
    const saveBtn = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetBtn');

    // Cropper Elements
    const cropBtn = document.getElementById('cropBtn');
    const reuploadBtn = document.getElementById('reuploadBtn');
    const cropModal = document.getElementById('cropModal');
    const cropImage = document.getElementById('cropImage');
    const applyCropBtn = document.getElementById('applyCropBtn');
    const cancelCropBtn = document.getElementById('cancelCropBtn');

    // NEW: Inspection Elements
    const inspectColor = document.getElementById('inspectColor');
    const colorVal = document.getElementById('colorVal');
    const inspectSize = document.getElementById('inspectSize');
    const sizeVal = document.getElementById('sizeVal');
    const inspectDefects = document.getElementById('inspectDefects');
    const inspectTexture = document.getElementById('inspectTexture');

    // NEW: Nutrient Elements
    const nutrientN = document.getElementById('nutrientN');
    const nutrientP = document.getElementById('nutrientP');
    const nutrientK = document.getElementById('nutrientK');
    const nutrientAlert = document.getElementById('nutrientAlert');
    const toggleNutrientGuide = document.getElementById('toggleNutrientGuide');
    const nutrientGuide = document.getElementById('nutrientGuide');

    // State
    let currentFile = null;
    let currentImageUrl = null;
    let currentAnalysis = null;
    let backgroundUploadPromise = null;
    let currentBatchId = '';
    let currentLocation = { lat: null, lng: null, address: 'Unknown Location', city: '', province: '', region: '', country: '' };
    let cropper = null;

    // --- Initialization ---
    function initPassport() {
        // Real-time Clock
        setInterval(() => {
            const clockEl = document.getElementById('realtimeClock');
            if (clockEl) {
                clockEl.textContent = new Date().toLocaleString('en-PH', { 
                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', 
                    hour: '2-digit', minute: '2-digit', second: '2-digit' 
                });
            }
        }, 1000);

        // Generate Batch ID
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        currentBatchId = `AGR-${timestamp}-${random}`;
        batchIdBadge.textContent = currentBatchId;

        // Get Location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                currentLocation.lat = position.coords.latitude;
                currentLocation.lng = position.coords.longitude;
                
                try {
                    // Reverse Geocoding using OpenStreetMap (Free)
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentLocation.lat}&lon=${currentLocation.lng}`);
                    const data = await res.json();
                    
                    const addr = data.address || {};
                    currentLocation.city = addr.city || addr.town || addr.municipality || addr.village || '';
                    currentLocation.province = addr.province || addr.county || '';
                    currentLocation.region = addr.state || addr.region || '';
                    currentLocation.country = addr.country || '';
                    
                    currentLocation.address = [currentLocation.city, currentLocation.province, currentLocation.region, currentLocation.country].filter(Boolean).join(', ');
                    
                    locationBadge.innerHTML = `<i data-lucide="map-pin" class="w-3 h-3 inline"></i> ${currentLocation.address || 'Location Found'}`;
                    lucide.createIcons();
                } catch (e) {
                    locationBadge.textContent = `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`;
                }
            }, (err) => {
                locationBadge.textContent = "Location Access Denied";
            });
        }
    }

    initPassport();

    // --- Quality Check ---
    function getBlurAndBrightness(imageElement) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const size = 250; // Scale down for performance
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(imageElement, 0, 0, size, size);
        
        try {
            const imageData = ctx.getImageData(0, 0, size, size);
            const data = imageData.data;

            let brightnessSum = 0;
            for (let i = 0; i < data.length; i += 4) {
                brightnessSum += (data[i] + data[i+1] + data[i+2]) / 3;
            }
            const brightness = brightnessSum / (size * size);

            // Simple contrast/blur check (Standard Deviation of pixel intensities)
            let mean = brightness;
            let varianceSum = 0;
            for (let i = 0; i < data.length; i += 4) {
                let pixelBrightness = (data[i] + data[i+1] + data[i+2]) / 3;
                varianceSum += Math.pow(pixelBrightness - mean, 2);
            }
            const stdDev = Math.sqrt(varianceSum / (size * size));

            return { brightness, stdDev };
        } catch (e) {
            return { brightness: 100, stdDev: 50 }; // Fallback if canvas tainted
        }
    }

    // --- File Handling ---

    function startBackgroundUpload(file) {
        currentImageUrl = null; // Reset
        uploadStatus.textContent = "Uploading photo in background...";
        uploadStatus.classList.remove('hidden');
        uploadBox.classList.add('processing');
        
        backgroundUploadPromise = API.uploadPhoto(file)
            .then(res => {
                currentImageUrl = res.photo_url;
                uploadStatus.textContent = "Photo uploaded successfully!";
                setTimeout(() => uploadStatus.classList.add('hidden'), 2000);
                uploadBox.classList.remove('processing');
                return res.photo_url;
            })
            .catch(err => {
                console.error("Background upload failed:", err);
                uploadStatus.textContent = "Upload failed. Will save offline.";
                uploadBox.classList.remove('processing');
                return null;
            });
    }

    uploadBox.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; // Don't trigger file input if button clicked
        fileInput.click();
    });

    reuploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            currentFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                
                // Start uploading immediately in the background
                startBackgroundUpload(file);
                
                previewImg.onload = () => {
                    const quality = getBlurAndBrightness(previewImg);
                    const warningEl = document.getElementById('qualityWarning');
                    if (quality.brightness < 40) {
                        warningEl.innerHTML = "⚠️ <strong>Photo is too dark.</strong> Please retake in better lighting for accurate grading.";
                        warningEl.classList.remove('hidden');
                    } else if (quality.stdDev < 20) {
                        warningEl.innerHTML = "⚠️ <strong>Photo appears blurry or low contrast.</strong> Please retake and ensure the crop is in focus.";
                        warningEl.classList.remove('hidden');
                    } else {
                        warningEl.classList.add('hidden');
                    }
                };

                uploadPlaceholder.classList.add('hidden');
                previewContainer.classList.remove('hidden');
                gradeBtn.disabled = false;
                
                // Reset analysis if new file
                resultCard.classList.add('hidden');
                saveForm.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    // --- Cropping Logic ---

    cropBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cropImage.src = previewImg.src;
        cropModal.classList.remove('hidden');
        
        if (cropper) cropper.destroy();
        cropper = new Cropper(cropImage, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 0.8
        });
    });

    cancelCropBtn.addEventListener('click', () => {
        cropModal.classList.add('hidden');
        if (cropper) cropper.destroy();
    });

    applyCropBtn.addEventListener('click', () => {
        const canvas = cropper.getCroppedCanvas({
            width: 800,
            height: 800
        });
        
        canvas.toBlob((blob) => {
            currentFile = new File([blob], "cropped.jpg", { type: "image/jpeg" });
            startBackgroundUpload(currentFile);
            previewImg.src = canvas.toDataURL('image/jpeg');
            cropModal.classList.add('hidden');
            if (cropper) cropper.destroy();
        }, 'image/jpeg');
    });

    // --- Handlers ---
    inspectColor.addEventListener('input', () => colorVal.textContent = inspectColor.value);
    inspectSize.addEventListener('input', () => sizeVal.textContent = inspectSize.value);

    document.getElementById('toggleVisualGuide').addEventListener('click', () => {
        document.getElementById('visualGuide').classList.toggle('hidden');
    });

    toggleNutrientGuide.addEventListener('click', () => {
        nutrientGuide.classList.toggle('hidden');
    });

    // Privacy Policy Modal
    const openPrivacyBtn = document.getElementById('openPrivacyBtn');
    const closePrivacyBtn = document.getElementById('closePrivacyBtn');
    const privacyModal = document.getElementById('privacyModal');

    if (openPrivacyBtn && closePrivacyBtn && privacyModal) {
        openPrivacyBtn.addEventListener('click', () => {
            privacyModal.classList.remove('hidden');
        });
        closePrivacyBtn.addEventListener('click', () => {
            privacyModal.classList.add('hidden');
        });
    }

    function checkNutrients() {
        const nVal = nutrientN.value;
        const pVal = nutrientP.value;
        const kVal = nutrientK.value;
        
        if (nVal === '' && pVal === '' && kVal === '') {
            nutrientAlert.classList.add('hidden');
            return;
        }

        const n = parseInt(nVal) || 0;
        const p = parseInt(pVal) || 0;
        const k = parseInt(kVal) || 0;
        const crop = cropTypeSelect.value;

        let nReq = 20, pReq = 15, kReq = 20;
        let cropAdvice = "";

        if (crop === 'Mango') { 
            nReq = 30; pReq = 10; kReq = 40; 
            cropAdvice = "Mangoes need high Potassium (K) for fruit size and sweetness."; 
        } else if (crop.includes('Banana')) { 
            nReq = 40; pReq = 15; kReq = 50; 
            cropAdvice = "Bananas are heavy Potassium (K) feeders."; 
        } else if (crop === 'Tomato') { 
            nReq = 25; pReq = 20; kReq = 35; 
            cropAdvice = "Tomatoes need balanced Phosphorus (P) and Potassium (K) for blooming."; 
        } else if (crop === 'Eggplant') {
            nReq = 25; pReq = 15; kReq = 30;
            cropAdvice = "Eggplants require steady Nitrogen (N) and Potassium (K).";
        } else if (crop === 'Ampalaya') {
            nReq = 20; pReq = 20; kReq = 25;
            cropAdvice = "Ampalaya needs balanced nutrients for continuous fruiting.";
        }

        let alerts = [];
        if (cropAdvice) alerts.push(`<em style="color: var(--primary); font-weight: bold;">Crop Info: ${cropAdvice}</em><br>`);

        if (nVal !== '' && n < nReq) alerts.push(`<strong>Nitrogen (N) Low:</strong> Target is ${nReq}+. Fix: Apply Urea or organic compost.`);
        if (pVal !== '' && p < pReq) alerts.push(`<strong>Phosphorus (P) Low:</strong> Target is ${pReq}+. Fix: Apply Bone Meal or Superphosphate.`);
        if (kVal !== '' && k < kReq) alerts.push(`<strong>Potassium (K) Low:</strong> Target is ${kReq}+. Fix: Apply Muriate of Potash.`);

        if (alerts.length > 0) {
            nutrientAlert.innerHTML = alerts.join('<br>');
            nutrientAlert.classList.remove('hidden');
        } else {
            nutrientAlert.innerHTML = `<strong>Nutrients Optimal:</strong> Levels are sufficient for ${crop}.`;
            nutrientAlert.classList.remove('hidden');
        }
    }

    [nutrientN, nutrientP, nutrientK].forEach(el => el.addEventListener('input', checkNutrients));
    cropTypeSelect.addEventListener('change', checkNutrients);

    function calculateManualGrade() {
        const color = parseInt(inspectColor.value);
        const size = parseInt(inspectSize.value);
        const defects = parseInt(inspectDefects.value);
        const texture = inspectTexture.value;

        let grade = 'C';
        let explanation = '';

        // Plain English Logic:
        if (color >= 8 && size >= 8 && defects === 0 && texture === 'smooth') {
            grade = 'A';
            explanation = 'Excellent quality based on visual inspection.';
        } else if (color >= 6 && size >= 6 && defects <= 1 && texture !== 'shriveled') {
            grade = 'B';
            explanation = 'Good quality, meets standard market requirements.';
        } else {
            grade = 'C';
            explanation = 'Lower quality, recommended for processing.';
        }

        // Nutrient Logic Integration
        const nVal = nutrientN.value;
        const pVal = nutrientP.value;
        const kVal = nutrientK.value;

        if (nVal !== '' || pVal !== '' || kVal !== '') {
            const n = parseInt(nVal) || 0;
            const p = parseInt(pVal) || 0;
            const k = parseInt(kVal) || 0;
            
            let deficient = false;
            if (nVal !== '' && n < 20) deficient = true;
            if (pVal !== '' && p < 15) deficient = true;
            if (kVal !== '' && k < 20) deficient = true;

            if (deficient) {
                if (grade === 'A') {
                    grade = 'B';
                    explanation += ' Downgraded to B due to detected nutrient deficiencies.';
                } else if (grade === 'B') {
                    explanation += ' Nutrient deficiencies noted, but remains Grade B.';
                }
            }
        }

        return { grade, explanation };
    }

    // --- Grading ---

    gradeBtn.addEventListener('click', async () => {
        if (!currentFile) return;

        // If upload still in progress, show waiting
        if (backgroundUploadPromise && !currentImageUrl) {
            gradeBtn.disabled = true;
            gradeBtn.innerHTML = '<div class="spinner-small"></div> Uploading...';
            await backgroundUploadPromise;
            gradeBtn.disabled = false;
            gradeBtn.innerHTML = '<i data-lucide="zap"></i> Calculate Grade 🚀';
            lucide.createIcons();
        }

        // Visual Feedback
        resultCard.classList.add('hidden');
        saveForm.classList.add('hidden');

        // Calculate Grade Locally (Instant)
        const { grade, explanation } = calculateManualGrade();
        
        const analysis = {
            grade: grade,
            confidence: 100,
            explanation: explanation,
            key_observations: [
                `Color Score: ${inspectColor.value}/10`,
                `Size Score: ${inspectSize.value}/10`,
                `Defects: ${inspectDefects.options[inspectDefects.selectedIndex].text}`,
                `Texture: ${inspectTexture.options[inspectTexture.selectedIndex].text}`
            ],
            suggested_price_range: grade === 'A' ? "₱80-₱100" : grade === 'B' ? "₱50-₱70" : "₱20-₱40",
            recommended_action: grade === 'A' ? 'Premium Export/Sell' : grade === 'B' ? 'Local Retail' : 'Process/Juice'
        };

        if (nutrientN.value !== '' || nutrientP.value !== '' || nutrientK.value !== '') {
            analysis.key_observations.push(`Nutrients: N(${nutrientN.value || '-'}) P(${nutrientP.value || '-'}) K(${nutrientK.value || '-'})`);
        }

        currentAnalysis = analysis;
        displayResult(analysis);
    });

    function displayResult(data) {
        // Grade Badge
        gradeBadge.textContent = data.grade;
        gradeBadge.className = 'grade-badge ' + 
            (data.grade === 'A' ? 'badge-a' : data.grade === 'B' ? 'badge-b' : 'badge-c');

        // Action Tag
        actionTag.textContent = data.recommended_action;
        const action = data.recommended_action.toLowerCase();
        actionTag.className = 'tag ' + 
            (action.includes('sell') ? 'tag-sell' : action.includes('store') ? 'tag-store' : 'tag-process');

        // Confidence
        confidenceLabel.textContent = `Confidence: ${data.confidence}%`;
        confidenceBar.style.width = `${data.confidence}%`;

        // Text
        explanation.textContent = data.explanation;
        observations.innerHTML = data.key_observations.map(obs => `<li>${obs}</li>`).join('');
        priceText.textContent = data.suggested_price_range;

        // Show card
        resultCard.classList.remove('hidden');
        resultCard.scrollIntoView({ behavior: 'smooth' });
    }

    // --- Actions ---

    confirmBtn.addEventListener('click', () => {
        saveForm.classList.remove('hidden');
        saveForm.scrollIntoView({ behavior: 'smooth' });
    });

    overrideBtn.addEventListener('click', () => {
        overridePanel.classList.toggle('hidden');
        manualGradeSelect.value = currentAnalysis.grade;
        saveForm.classList.remove('hidden');
    });

    // --- Saving ---

    saveBtn.addEventListener('click', async () => {
        const graderName = document.getElementById('graderName').value;
        const barangay = document.getElementById('locationBarangay').value;
        const notes = document.getElementById('notes').value;
        
        const isOverridden = !overridePanel.classList.contains('hidden');
        const finalGrade = isOverridden ? manualGradeSelect.value : currentAnalysis.grade;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Uploading & Saving...';
        uploadStatus.textContent = "Uploading photo & saving record...";
        uploadStatus.classList.remove('hidden');

        try {
            // 1. Ensure Photo is Uploaded (Wait for background upload if still running)
            let photoUrl = currentImageUrl;
            if (backgroundUploadPromise && !photoUrl) {
                photoUrl = await backgroundUploadPromise;
            }
            
            // Fallback if background upload failed or didn't start
            if (currentFile && !photoUrl) {
                try {
                    const uploadRes = await API.uploadPhoto(currentFile);
                    photoUrl = uploadRes.photo_url;
                    currentImageUrl = photoUrl;
                } catch (uploadErr) {
                    console.warn("Upload failed, using local photo data for offline save.", uploadErr);
                    // Use local base64 as fallback so the user doesn't lose data
                    photoUrl = previewImg.src; 
                }
            }

            const record = {
                batch_id: currentBatchId,
                latitude: currentLocation.lat,
                longitude: currentLocation.lng,
                address: currentLocation.address,
                city: currentLocation.city,
                province: currentLocation.province,
                region: currentLocation.region,
                country: currentLocation.country,
                photo_url: photoUrl,
                crop_type: cropTypeSelect.value,
                grade: finalGrade,
                confidence: currentAnalysis.confidence,
                explanation: currentAnalysis.explanation,
                key_observations: currentAnalysis.key_observations,
                suggested_price_range: currentAnalysis.suggested_price_range,
                recommended_action: currentAnalysis.recommended_action,
                grader_name: graderName,
                location_barangay: barangay,
                notes: notes,
                ai_graded: false, // Changed to false since we are using manual logic
                override_reason: isOverridden ? overrideReason.value : '',
                color_score: parseInt(inspectColor.value),
                size_score: parseInt(inspectSize.value),
                defects: inspectDefects.options[inspectDefects.selectedIndex].text,
                texture: inspectTexture.options[inspectTexture.selectedIndex].text,
                nutrient_n: nutrientN.value !== '' ? parseInt(nutrientN.value) : null,
                nutrient_p: nutrientP.value !== '' ? parseInt(nutrientP.value) : null,
                nutrient_k: nutrientK.value !== '' ? parseInt(nutrientK.value) : null
            };

            try {
                await API.saveRecord(record);
            } catch (saveErr) {
                console.warn("Online save failed, saving offline.", saveErr);
                await saveOffline(record);
                alert("Saved offline! The record will be synced when you have a connection and the database is ready.");
            }
            
            // Also save to Local Storage for "Personal Use"
            const localHistory = JSON.parse(localStorage.getItem('agriintel_history') || '[]');
            localHistory.unshift({ ...record, created_at: new Date().toISOString() });
            localStorage.setItem('agriintel_history', JSON.stringify(localHistory.slice(0, 50)));

            // Success
            resultCard.classList.add('hidden');
            saveForm.classList.add('hidden');
            successMsg.classList.remove('hidden');
            successMsg.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            alert('An unexpected error occurred: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i data-lucide="save"></i> I-save ang Grade';
            uploadStatus.classList.add('hidden');
            lucide.createIcons();
        }
    });

    // --- Offline DB Logic (IndexedDB) ---
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

    async function saveOffline(record) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('offline_records', 'readwrite');
            const store = tx.objectStore('offline_records');
            store.add({ record, timestamp: new Date().toISOString() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // Attempt to sync offline records when online
    window.addEventListener('online', async () => {
        console.log("Online: Attempting to sync offline records...");
        try {
            const db = await initDB();
            const tx = db.transaction('offline_records', 'readonly');
            const store = tx.objectStore('offline_records');
            const request = store.getAll();
            
            request.onsuccess = async () => {
                const records = request.result;
                if (records.length > 0) {
                    for (const item of records) {
                        try {
                            // If photo is a local data URL, we should ideally upload it first, 
                            // but for simplicity we'll try to save the record. 
                            // Supabase text columns might reject huge base64 strings, 
                            // so we might need to handle that if it happens.
                            await API.saveRecord(item.record);
                            
                            // Delete from offline store if successful
                            const delTx = db.transaction('offline_records', 'readwrite');
                            delTx.objectStore('offline_records').delete(item.id);
                        } catch (e) {
                            console.error("Failed to sync record", item.id, e);
                        }
                    }
                    alert("Offline records synced successfully!");
                }
            };
        } catch (e) {
            console.error("Sync failed", e);
        }
    });

    resetBtn.addEventListener('click', () => {
        location.reload();
    });
});
