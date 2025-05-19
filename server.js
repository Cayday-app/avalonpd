const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Ensure chat messages file exists
const CHAT_FILE = path.join(__dirname, 'chat_messages.json');
if (!fs.existsSync(CHAT_FILE)) {
    fs.writeFileSync(CHAT_FILE, JSON.stringify([]));
}

// Validate Discord token
async function validateToken(token) {
    try {
        const response = await fetch('https://discord.com/api/users/@me', {
            headers: { 'Authorization': token }
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Chat API endpoints
app.get('/api/chat/messages', async (req, token) => {
    try {
        // Validate token
        const token = req.headers.authorization;
        if (!token || !(await validateToken(token))) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const messages = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
        res.json(messages);
    } catch (error) {
        console.error('Error reading messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/chat/messages', async (req, res) => {
    try {
        // Validate token
        const token = req.headers.authorization;
        if (!token || !(await validateToken(token))) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const messages = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
        const newMessage = {
            id: Date.now(),
            ...req.body,
            timestamp: Date.now(),
            reactions: [],
            edited: false
        };
        
        messages.push(newMessage);
        fs.writeFileSync(CHAT_FILE, JSON.stringify(messages, null, 2));
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/chat/messages/:id', async (req, res) => {
    try {
        // Validate token
        const token = req.headers.authorization;
        if (!token || !(await validateToken(token))) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const messages = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
        const messageId = parseInt(req.params.id);
        const messageIndex = messages.findIndex(m => m.id === messageId);
        
        if (messageIndex === -1) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        if (messages[messageIndex].authorId !== req.body.authorId) {
            return res.status(403).json({ error: 'Not authorized to edit this message' });
        }
        
        messages[messageIndex].text = req.body.text;
        messages[messageIndex].edited = true;
        
        fs.writeFileSync(CHAT_FILE, JSON.stringify(messages, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error editing message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/chat/messages/:id', async (req, res) => {
    try {
        // Validate token
        const token = req.headers.authorization;
        if (!token || !(await validateToken(token))) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const messages = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
        const messageId = parseInt(req.params.id);
        const authorId = req.query.authorId;
        
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        if (messages[messageIndex].authorId !== authorId) {
            return res.status(403).json({ error: 'Not authorized to delete this message' });
        }
        
        messages.splice(messageIndex, 1);
        fs.writeFileSync(CHAT_FILE, JSON.stringify(messages, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 