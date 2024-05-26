const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const awsServerlessExpress = require('aws-serverless-express');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
app.use(cors());

const IMAGES_DIR = '/tmp/images';

// Create the images directory if it doesn't exist
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR);
}

// Create the images directory if it doesn't exist
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR);
}

async function authorize() {
    const jwtClient = new google.auth.JWT(
        process.env.CLIENT_EMAIL,
        null,
        process.env.PRIVATE_KEY.replace(/\\n/g, '\n'), // Replace escaped newlines
        ['https://www.googleapis.com/auth/drive']
    );
    await jwtClient.authorize();
    return jwtClient;
}

async function listFiles(authClient, folderId) {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const res = await drive.files.list({
        q: `'${folderId}' in parents`,
        fields: 'files(id, name)', // Include file name field
    });
    return res.data.files;
}

async function downloadFile(authClient, fileId, dest) {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const destStream = fs.createWriteStream(dest);
    await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' },
        (err, res) => {
            if (err) return console.error('Error downloading file:', err);
            res.data
                .on('end', () => {
                    console.log('Downloaded file:', dest);
                })
                .on('error', (err) => {
                    console.error('Error downloading file:', err);
                })
                .pipe(destStream);
        }
    );
}

app.get('/', (req, res) => {    
    res.send('Google drive api!');
});

app.get('/api/images', async (req, res) => {
    try {
        const authClient = await authorize();
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID; // Replace with your folder's ID
        const imageFiles = await listFiles(authClient, folderId);

        // Map the imageFiles array to include the shareable link
        const fileUrls = imageFiles.map(file => ({
            id: file.id,
            name: file.name,
            url: file.webViewLink || file.webContentLink // Use either webViewLink or webContentLink
        }));

        res.json(fileUrls);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Serve the images statically from the images directory
app.use('/images', express.static(IMAGES_DIR));

// Export the Express.js app
module.exports = app;
