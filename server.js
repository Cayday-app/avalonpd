const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Message storage
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Helper to read messages
function readMessages() {
    try {
        if (!fs.existsSync(MESSAGES_FILE)) {
            return [];
        }
        return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    } catch (error) {
        console.error('Error reading messages:', error);
        return [];
    }
}

// Helper to write messages
function writeMessages(messages) {
    try {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    } catch (error) {
        console.error('Error writing messages:', error);
        throw error;
    }
}

// Helper to validate Discord token
async function validateToken(token) {
    try {
        const response = await fetch('https://discord.com/api/users/@me', {
            headers: { 'Authorization': token }
        });
        return response.ok;
    } catch (error) {
        console.error('Token validation error:', error);
        return false;
    }
}

// Auth middleware
async function authMiddleware(req, res, next) {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ error: 'No authorization token provided' });
    }

    const isValid = await validateToken(token);
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid authorization token' });
    }

    next();
}

// Chat endpoints
app.get('/api/chat', authMiddleware, (req, res) => {
    try {
        const messages = readMessages();
        res.json(messages);
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

app.post('/api/chat', authMiddleware, (req, res) => {
    try {
        const messages = readMessages();
        const newMessage = {
            id: Date.now(),
            ...req.body,
            timestamp: Date.now(),
            reactions: [],
            edited: false
        };
        
        messages.push(newMessage);
        writeMessages(messages);
        res.json(newMessage);
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'Failed to create message' });
    }
});

app.put('/api/chat/:id', authMiddleware, (req, res) => {
    try {
        const messages = readMessages();
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
        
        writeMessages(messages);
        res.json(messages[messageIndex]);
    } catch (error) {
        console.error('Error updating message:', error);
        res.status(500).json({ error: 'Failed to update message' });
    }
});

app.delete('/api/chat/:id', authMiddleware, (req, res) => {
    try {
        const messages = readMessages();
        const messageId = parseInt(req.params.id);
        const messageIndex = messages.findIndex(m => m.id === messageId);
        
        if (messageIndex === -1) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        if (messages[messageIndex].authorId !== req.query.authorId) {
            return res.status(403).json({ error: 'Not authorized to delete this message' });
        }
        
        const deletedMessage = messages.splice(messageIndex, 1)[0];
        writeMessages(messages);
        res.json(deletedMessage);
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

app.post('/api/chat/:id/reactions', authMiddleware, (req, res) => {
    try {
        const messages = readMessages();
        const messageId = parseInt(req.params.id);
        const messageIndex = messages.findIndex(m => m.id === messageId);
        
        if (messageIndex === -1) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        const reaction = req.body;
        const existingReactionIndex = messages[messageIndex].reactions.findIndex(r =>
            r.emoji === reaction.emoji && r.userId === reaction.userId
        );
        
        if (existingReactionIndex !== -1) {
            messages[messageIndex].reactions.splice(existingReactionIndex, 1);
        } else {
            messages[messageIndex].reactions.push(reaction);
        }
        
        writeMessages(messages);
        res.json({ reactions: messages[messageIndex].reactions });
    } catch (error) {
        console.error('Error updating reactions:', error);
        res.status(500).json({ error: 'Failed to update reactions' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 