const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const apikeys = require('./api.json');
const SCOPE = ['https://www.googleapis.com/auth/drive'];
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const IMAGES_DIR = '/tmp/images'; // Store images in /tmp directory for AWS Lambda

// Create the images directory if it doesn't exist
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR);
}

async function authorize() {
    const jwtClient = new google.auth.JWT(
        apikeys.client_email,
        null,
        apikeys.private_key,
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

app.get('/api/images', async (req, res) => {
    try {
        const authClient = await authorize();
        const folderId = '1l2wv2kbFj4J7-LVTVfH7_T0ECvJAbsXm'; // Replace with your folder's ID
        const imageFiles = await listFiles(authClient, folderId);

        // Download each file to the local images directory
        for (const file of imageFiles) {
            const dest = path.join(IMAGES_DIR, file.name);
            if (!fs.existsSync(dest)) {
                await downloadFile(authClient, file.id, dest);
            }
        }

        res.json(imageFiles);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Serve the images statically from the images directory
app.use('/images', express.static(IMAGES_DIR));

module.exports = app; // Export the Express app for serverless deployment
