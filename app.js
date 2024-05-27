const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
require('dotenv').config(); // Load environment variables from .env file
const SCOPE = ['https://www.googleapis.com/auth/drive'];
const fs = require('fs');
const path = require('path');

const app = express();
// Enable CORS for the Vite React app
app.use(cors({
    origin: 'http://localhost:5173', // Allow requests from the Vite React app
    optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  }));
  app.use(express.json()); // Use JSON middleware to parse incoming JSON data
  
  // Serve the static React build files
  app.use(express.static(path.join(__dirname, './', 'client', 'dist')));

async function authorize() {
    const jwtClient = new google.auth.JWT(
        process.env.CLIENT_EMAIL,
        null,
        process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
        SCOPE
    );
    await jwtClient.authorize();
    return jwtClient;
}

async function listFiles(authClient, folderId) {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const res = await drive.files.list({
        q: `'${folderId}' in parents`,
        fields: 'files(id, name, webContentLink)', // Include webContentLink field
    });
    return res.data.files;
}

async function fetchImagesByFolderId(folderId) {
    try {
        const authClient = await authorize();
        let imageFiles = await listFiles(authClient, folderId);
        imageFiles = imageFiles.sort((a, b) => a.name.localeCompare(b.name));
        return imageFiles;
    } catch (error) {
        console.error('Error fetching images:', error);
        throw new Error('Internal Server Error');
    }
}

app.get('/api/images/day1', async (req, res) => {
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID_DAY1;
        const imageFiles = await fetchImagesByFolderId(folderId);
        res.json(imageFiles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/images/day2', async (req, res) => {
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID_DAY2;
        const imageFiles = await fetchImagesByFolderId(folderId);
        res.json(imageFiles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/images/carousel', async (req, res) => {
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID_CAROUSEL;
        const imageFiles = await fetchImagesByFolderId(folderId);
        res.json(imageFiles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, './', 'client', 'dist', 'index.html'));
  });

module.exports = app; // Export the Express app for serverless deployment