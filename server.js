/**
 * AgriIntel Backend - Node.js Express Server
 * Single-file backend for crop grading using Gemini 2.0 Flash and Supabase.
 */

import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// Load environment variables
dotenv.config();

export const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend files from 'public' folder

// Multer setup for memory storage (we don't save files locally)
const upload = multer({ storage: multer.memoryStorage() });

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Gemini Configuration
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- API ROUTES ---

/**
 * POST /api/upload-photo
 * Receives a photo, uploads it to Supabase Storage, and returns the public URL.
 */
app.post('/api/upload-photo', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No photo uploaded' });
        }

        const fileName = `${Date.now()}-${req.file.originalname}`;
        
        // Attempt to create bucket if it doesn't exist (might fail if anon key lacks permissions, but worth a try)
        try {
            const { data: buckets } = await supabase.storage.listBuckets();
            if (buckets && !buckets.find(b => b.name === 'crop-photos')) {
                console.log("Attempting to create 'crop-photos' bucket...");
                await supabase.storage.createBucket('crop-photos', { public: true });
            }
        } catch (bucketErr) {
            console.warn("Could not verify/create bucket automatically. Ensure 'crop-photos' exists and is public in your Supabase dashboard.");
        }

        // Upload to 'crop-photos' bucket
        const { data, error } = await supabase.storage
            .from('crop-photos')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (error) {
            if (error.message.includes('Bucket not found')) {
                throw new Error("Supabase Bucket 'crop-photos' does not exist. Please create a public bucket named 'crop-photos' in your Supabase Storage dashboard.");
            }
            if (error.message.includes('row-level security policy')) {
                throw new Error("Supabase Storage RLS Error: You need to allow public uploads. Go to Supabase -> Storage -> Policies, and create an INSERT policy for the 'crop-photos' bucket.");
            }
            throw error;
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
            .from('crop-photos')
            .getPublicUrl(fileName);

        res.json({ photo_url: publicUrl });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: error.message || 'Failed to upload photo' });
    }
});

/**
 * POST /api/grade
 * Receives a photo URL, fetches it, and uses Gemini to analyze the crop.
 */
app.post('/api/grade', async (req, res) => {
    try {
        const { photo_url, crop_type, manual_factors } = req.body;
        const { color, size, defects, texture } = manual_factors || {};

        if (!photo_url) {
            return res.status(400).json({ error: 'Photo URL is required' });
        }

        // 1. Fetch the photo and convert to base64
        const response = await fetch(photo_url);
        const buffer = await response.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';

        // 2. Prepare Gemini Prompt
        const systemPrompt = `
            You are a DA-accredited crop quality inspector in the Philippines. 
            Grade the ${crop_type || 'crop'} in this photo.
            
            MANUAL INSPECTION DATA (provided by farmer):
            - Color/Ripeness Score: ${color || 'N/A'}/10
            - Size/Shape Score: ${size || 'N/A'}/10
            - Defects Level: ${defects || 'N/A'} (0=None, 5=Severe)
            - Texture: ${texture || 'N/A'}
            
            Evaluate the photo against these manual factors. If the photo contradicts the manual data, prioritize the visual evidence but mention the discrepancy.
            
            Return ONLY valid JSON:
            {
                "grade": "A" | "B" | "C",
                "confidence": integer 0-100,
                "explanation": "2 sentences max, simple English",
                "key_observations": ["observation 1", "observation 2", "observation 3"],
                "suggested_price_range": "example: ₱45-₱55 per kilo",
                "recommended_action": "sell now" | "store 3-5 days" | "sell for processing"
            }
        `;

        // 3. Call Gemini 2.0 Flash
        const result = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: {
                parts: [
                    { text: `${systemPrompt}\n\nCrop Type: ${crop_type || 'Unknown'}` },
                    { inlineData: { data: base64Image, mimeType } }
                ]
            },
            config: {
                responseMimeType: 'application/json'
            }
        });

        // 4. Parse JSON Response
        try {
            const analysis = JSON.parse(result.text);
            res.json(analysis);
        } catch (parseError) {
            console.error('JSON Parse Error:', result.text);
            res.status(500).json({ error: 'Gemini returned invalid JSON' });
        }

    } catch (error) {
        console.error('Grading Error:', error);
        res.status(500).json({ error: 'Failed to analyze crop' });
    }
});

/**
 * POST /api/save-grade
 * Saves the final grading record to the Supabase database.
 */
app.post('/api/save-grade', async (req, res) => {
    try {
        const { 
            batch_id, latitude, longitude, address, city, province, region, country,
            photo_url, crop_type, grade, confidence, explanation, 
            key_observations, suggested_price_range, recommended_action, 
            grader_name, location_barangay, notes, ai_graded, override_reason,
            color_score, size_score, defects, texture, nutrient_n, nutrient_p, nutrient_k
        } = req.body;

        const { data, error } = await supabase
            .from('crop_grades')
            .insert([{
                batch_id,
                latitude,
                longitude,
                address,
                city,
                province,
                region,
                country,
                photo_url,
                crop_type,
                grade,
                confidence,
                explanation,
                key_observations,
                suggested_price_range,
                recommended_action,
                grader_name,
                location_barangay,
                notes,
                ai_graded,
                override_reason,
                color_score,
                size_score,
                defects,
                texture,
                nutrient_n,
                nutrient_p,
                nutrient_k
            }])
            .select();

        if (error) throw error;

        res.json(data[0]);
    } catch (error) {
        console.error('Save Error:', error);
        res.status(500).json({ error: 'Failed to save record' });
    }
});

/**
 * GET /api/grades
 * Retrieves all grading records, with optional filtering by crop type.
 */
app.get('/api/grades', async (req, res) => {
    try {
        const { crop_type } = req.query;

        let query = supabase
            .from('crop_grades')
            .select('*')
            .order('created_at', { ascending: false });

        if (crop_type) {
            query = query.eq('crop_type', crop_type);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch records' });
    }
});

// Start the server only if not running as a serverless function
if (process.env.NODE_ENV !== 'production' || !process.env.NETLIFY) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`AgriIntel Backend running at http://localhost:${PORT}`);
    });
}
