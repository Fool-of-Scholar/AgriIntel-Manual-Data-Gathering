
<div align="center">
<img width="1200" height="475" alt="AgriIntel Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🌾 AgriIntel - Crop Grading System

> Empowering Filipino smallholder farmers with AI-driven crop quality assessment and real-time market insights.

**AgriIntel** is an innovative web application designed specifically for farmers in Davao, Philippines, to grade crop quality using artificial intelligence, combined with manual inspection data for enhanced accuracy.

---

## ✨ Features

### 🤖 AI-Powered Crop Analysis
- Leverages **Google Gemini 2.0 Flash** to intelligently analyze crop photos
- Grades crops as **Grade A**, **Grade B**, or **Grade C**
- Provides confidence scores (0-100%) for each grading decision
- DA-accredited crop quality inspection standards

### 📸 Photo Upload & Management
- Seamless photo capture/upload directly from mobile or desktop
- Integration with **Supabase Storage** for secure image hosting
- Automatic timestamp and metadata tracking
- Support for multiple image formats (JPEG, PNG, etc.)

### 📝 Manual Data Collection
- Farmers input comprehensive inspection data:
  - Color/Ripeness Score (0-10)
  - Size/Shape Score (0-10)
  - Defects Level (0-5 scale)
  - Texture quality assessment
  - Nutrient indicators (N, P, K levels)
  - Location data (GPS coordinates, barangay, city, province, region)

### 🔄 AI + Manual Hybrid Validation
- Combines AI visual analysis with farmer-provided manual data
- Detects discrepancies between visual and manual observations
- Prioritizes visual evidence while flagging inconsistencies for farmer review
- Enables farmers to override AI grades with documented reasons

### 💰 Market Intelligence
- **Automated Price Suggestions**: Generates recommended price ranges in Philippine Pesos (₱)
- Considers crop grade, current market conditions, and quality metrics
- Helps farmers make informed selling decisions

### 📋 Action Recommendations
- **Sell Now**: For premium or time-sensitive crops
- **Store 3-5 Days**: For crops that can mature slightly
- **Sell for Processing**: For lower grades or specialty crops
- Smart recommendations based on grade, condition, and market factors

### 📍 Batch Tracking & Location
- Organize crops by batch ID for comprehensive tracking
- Complete location data collection (GPS, address, barangay, city, province, region)
- Historical records with batch-level reporting
- Geospatial analysis capabilities

### 💾 Database & Record Management
- Secure data storage with **Supabase PostgreSQL**
- Complete grading history with timestamps
- Fields for grader name, notes, and override documentation
- Export and filtering capabilities by crop type

### 🔍 Records Retrieval & Filtering
- View all grading records with filtering by crop type
- Sorted by most recent for quick access
- Detailed observations and key findings for each record
- Easy data auditing and compliance tracking

### 🌐 Deployment Ready
- Deployed on **Netlify** for fast, reliable performance
- Serverless backend with Node.js Express
- Scalable architecture ready for expansion
- Environment-based configuration for security

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Frontend** | JavaScript (Vite) |
| **Backend** | Node.js + Express.js |
| **AI** | Google Gemini 2.0 Flash |
| **Database** | Supabase (PostgreSQL) |
| **Storage** | Supabase Storage |
| **Deployment** | Netlify |
| **Image Processing** | CropperJS, Multer |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager
- Free Google Gemini API key
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Fool-of-Scholar/AgriIntel-Manual-Data-Gathering.git
   cd AgriIntel-Manual-Data-Gathering
