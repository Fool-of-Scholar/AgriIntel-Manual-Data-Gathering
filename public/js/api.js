const API = {
    async uploadPhoto(file, signal) {
        const formData = new FormData();
        formData.append('photo', file);
        const response = await fetch('/api/upload-photo', {
            method: 'POST',
            body: formData,
            signal
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload photo');
        }
        return response.json();
    },

    async gradeCrop(photo_url, crop_type, manual_factors) {
        const response = await fetch('/api/grade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photo_url, crop_type, manual_factors })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to grade crop');
        }
        return response.json();
    },

    async saveRecord(record) {
        const response = await fetch('/api/save-grade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save record');
        }
        return response.json();
    },

    async getHistory(crop_type = '') {
        let url = '/api/grades';
        if (crop_type) url += `?crop_type=${crop_type}`;
        const response = await fetch(url);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch history');
        }
        return response.json();
    }
};
