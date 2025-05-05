require('dotenv').config();
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const updatesHandler = require('./api/updates.js');
const fs = require('fs');
const config = require('./config');
const session = require('express-session');
const app = express();

const PORT = 3000; // Force port 3000
const REDIRECT_URI = `http://localhost:${PORT}`;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Set up session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // set to true if using https
}));

// Ensure the chat messages file exists
const CHAT_MESSAGES_FILE = path.join(__dirname, 'chat_messages.json');
if (!fs.existsSync(CHAT_MESSAGES_FILE)) {
    fs.writeFileSync(CHAT_MESSAGES_FILE, JSON.stringify([], null, 2));
}

// Store active users using Map for better lookup performance
const activeUsers = new Map();

// Function to clear all chat messages
function clearChatMessages() {
    chatMessages = [];
    saveChatMessages(chatMessages);
    
    // Notify all clients about chat clear
    notifyAllClients({
        type: 'clear-chat'
    });
    
    console.log('Chat messages cleared automatically at midnight EST');
}

// Schedule daily chat clear at 12:00 AM EST
function scheduleDailyChatClear() {
    const now = new Date();
    const estOffset = -4; // EST offset from UTC (adjust for daylight savings if needed)
    
    // Calculate time until next midnight EST
    let targetTime = new Date();
    targetTime.setHours(24 + estOffset, 0, 0, 0); // Set to next midnight EST
    
    if (targetTime <= now) {
        // If target time is in the past, set it to the next day
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const msUntilMidnight = targetTime - now;
    
    // Schedule first run
    setTimeout(() => {
        clearChatMessages();
        
        // Schedule subsequent runs every 24 hours
        setInterval(clearChatMessages, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
    
    console.log(`Chat clear scheduled. First clear in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
}

// Start the daily chat clear schedule
scheduleDailyChatClear();

// Load chat messages from file
function loadChatMessages() {
    try {
        const data = fs.readFileSync(CHAT_MESSAGES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error loading chat messages:', err);
        return [];
    }
}

// Save chat messages to file
function saveChatMessages(messages) {
    try {
        // Use asynchronous file write to avoid blocking the server
        fs.writeFile(CHAT_MESSAGES_FILE, JSON.stringify(messages, null, 2), (err) => {
            if (err) {
                console.error('Error saving chat messages:', err);
            }
        });
    } catch (err) {
        console.error('Error saving chat messages:', err);
    }
}

// Initialize chat messages from file
let chatMessages = loadChatMessages();

// Discord token exchange endpoint
app.post('/api/discord/token', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    try {
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID || '1363747847039881347',
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('Discord API Error:', errorData);
            throw new Error('Failed to exchange code for token');
        }

        const data = await tokenResponse.json();
        res.status(200).json(data);
    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(500).json({ error: 'Failed to exchange code for token' });
    }
});

// Create announcement endpoint
app.post('/api/updates', updatesHandler);

// Delete announcement endpoint (HR users via client control)
app.delete('/api/updates/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    try {
        const filePath = path.join(process.cwd(), 'updates.json');
        const updates = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const filtered = updates.filter(u => u.id !== id);
        fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2));
        res.status(200).json({ message: 'Deleted' });
    } catch (err) {
        console.error('Error deleting update:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Set up server-sent events endpoint for real-time notifications
app.get('/api/notifications/stream', (req, res) => {
    // Set headers for server-sent events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send a comment to keep the connection alive
    res.write('retry: 10000\n\n');
    
    // Send initial event
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    
    // Store client connection
    const clientId = Date.now();
    clients.set(clientId, res);
    
    // Handle client disconnect
    req.on('close', () => {
        clients.delete(clientId);
    });
});

// Chat message API endpoints
// Get all messages
app.get('/api/chat/messages', (req, res) => {
    res.status(200).json(chatMessages);
});

// Create a new message
app.post('/api/chat/messages', (req, res) => {
    const { author, authorId, avatar, text, reactions } = req.body;
    
    if (!author || !authorId || !text) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create new message
    const newMessage = {
        id: Date.now(),
        author,
        authorId, 
        avatar,
        text,
        timestamp: Date.now(),
        reactions: reactions || [],
        edited: false
    };
    
    // Add to messages array
    chatMessages.push(newMessage);
    
    // Send response immediately before file operation
    res.status(201).json(newMessage);
    
    // Notify all clients about new message
    notifyAllClients({
        type: 'new-message',
        message: newMessage
    });
    
    // Save to file (after response sent)
    saveChatMessages(chatMessages);
    
    console.log(`New message from ${author}: ${text.substring(0, 20)}...`);
});

// Edit a message
app.put('/api/chat/messages/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { text, authorId } = req.body;
    
    if (!text || !authorId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find message
    const messageIndex = chatMessages.findIndex(m => m.id === id);
    
    if (messageIndex === -1) {
        return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if user is author
    if (chatMessages[messageIndex].authorId !== authorId) {
        return res.status(403).json({ error: 'Not authorized to edit this message' });
    }
    
    // Update message
    chatMessages[messageIndex].text = text;
    chatMessages[messageIndex].edited = true;
    
    // Send response immediately
    res.status(200).json(chatMessages[messageIndex]);
    
    // Notify all clients about edited message
    notifyAllClients({
        type: 'edit-message',
        message: chatMessages[messageIndex]
    });
    
    // Save to file (after response sent)
    saveChatMessages(chatMessages);
    
    console.log(`Message ${id} edited by ${chatMessages[messageIndex].author}`);
});

// Delete a message
app.delete('/api/chat/messages/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { authorId } = req.query;
    
    if (!authorId) {
        return res.status(400).json({ error: 'Missing authorId parameter' });
    }
    
    // Find message
    const messageIndex = chatMessages.findIndex(m => m.id === id);
    
    if (messageIndex === -1) {
        return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if user is author
    if (chatMessages[messageIndex].authorId !== authorId) {
        return res.status(403).json({ error: 'Not authorized to delete this message' });
    }
    
    // Get message for notification
    const deletedMessage = chatMessages[messageIndex];
    
    // Remove message
    chatMessages.splice(messageIndex, 1);
    
    // Send response immediately
    res.status(200).json({ success: true });
    
    // Notify all clients about deleted message
    notifyAllClients({
        type: 'delete-message',
        messageId: id
    });
    
    // Save to file (after response sent)
    saveChatMessages(chatMessages);
    
    console.log(`Message ${id} deleted by ${deletedMessage.author}`);
});

// Clear all messages (HR only)
app.delete('/api/chat/messages', (req, res) => {
    // Clear all messages
    chatMessages = [];
    
    // Send response immediately
    res.status(200).json({ success: true });
    
    // Notify all clients about chat clear
    notifyAllClients({
        type: 'clear-chat'
    });
    
    // Save to file (after response sent)
    saveChatMessages(chatMessages);
    
    console.log('All chat messages cleared by HR');
});

// Add reaction to a message
app.post('/api/chat/messages/:id/reactions', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { emoji, username, userId } = req.body;
    
    if (!emoji || !username || !userId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find message
    const messageIndex = chatMessages.findIndex(m => m.id === id);
    
    if (messageIndex === -1) {
        return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if reaction already exists
    const reactionIndex = chatMessages[messageIndex].reactions.findIndex(r => 
        r.emoji === emoji && r.userId === userId
    );
    
    if (reactionIndex !== -1) {
        // Remove reaction
        chatMessages[messageIndex].reactions.splice(reactionIndex, 1);
        console.log(`Reaction ${emoji} removed by ${username} on message ${id}`);
    } else {
        // Add reaction
        chatMessages[messageIndex].reactions.push({
            emoji,
            username,
            userId
        });
        console.log(`Reaction ${emoji} added by ${username} on message ${id}`);
    }
    
    // Send response immediately with updated reactions
    res.status(200).json({ 
        success: true,
        reactions: chatMessages[messageIndex].reactions
    });
    
    // Notify all clients about reaction change
    notifyAllClients({
        type: 'reaction-change',
        messageId: id,
        reactions: chatMessages[messageIndex].reactions
    });
    
    // Save to file (after response sent)
    saveChatMessages(chatMessages);
});

// Register a user as active
app.post('/api/chat/active', (req, res) => {
    const { id, username, avatar } = req.body;
    
    if (!id || !username) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user is already registered to avoid spam logs
    const existingUser = activeUsers.get(id);
    const now = Date.now();
    
    // Only update if user doesn't exist or last active time is older than 10 seconds
    if (!existingUser || (now - existingUser.lastActive > 10000)) {
        // Store user with timestamp
        activeUsers.set(id, {
            id,
            username,
            avatar,
            lastActive: now
        });
        
        console.log(`User ${username} (${id}) registered as active`);
        console.log(`Total active users: ${activeUsers.size}`);
        
        // Notify all clients about user presence change
        notifyAllClients({ 
            type: 'user-active',
            users: Array.from(activeUsers.values())
        });
    } else {
        // Update last active time silently
        existingUser.lastActive = now;
        activeUsers.set(id, existingUser);
    }
    
    res.status(200).json({ success: true });
});

// Get all active users
app.get('/api/chat/active', (req, res) => {
    // Clean up inactive users (more than 2 minutes)
    const now = Date.now();
    for (const [id, user] of activeUsers.entries()) {
        if (now - user.lastActive > 2 * 60 * 1000) {
            activeUsers.delete(id);
            console.log(`Removed inactive user: ${user.username}`);
        }
    }
    
    res.status(200).json(Array.from(activeUsers.values()));
});

// Set user as inactive (for logout)
app.delete('/api/chat/active/:id', (req, res) => {
    const { id } = req.params;
    
    if (activeUsers.has(id)) {
        const user = activeUsers.get(id);
        console.log(`User ${user.username} (${id}) set as inactive`);
        activeUsers.delete(id);
        
        // Notify all clients
        notifyAllClients({ 
            type: 'user-inactive',
            users: Array.from(activeUsers.values())
        });
    }
    
    res.status(200).json({ success: true });
});

// Ping to update last active time
app.put('/api/chat/active/:id', (req, res) => {
    const { id } = req.params;
    
    if (activeUsers.has(id)) {
        const user = activeUsers.get(id);
        user.lastActive = Date.now();
        activeUsers.set(id, user);
    }
    
    res.status(200).json({ success: true });
});

// Store connected clients for server-sent events
const clients = new Map();

// Function to notify all connected clients
function notifyAllClients(data) {
    try {
        // Skip notification if no clients connected
        if (clients.size === 0) {
            return;
        }
        
        const jsonData = JSON.stringify(data);
        const deadClients = [];
        
        clients.forEach((client, id) => {
            try {
                client.write(`data: ${jsonData}\n\n`);
            } catch (err) {
                console.error('Error sending to client:', err);
                deadClients.push(id);
            }
        });
        
        // Clean up dead clients
        deadClients.forEach(id => clients.delete(id));
    } catch (err) {
        console.error('Error in notifyAllClients:', err);
    }
}

// Check for updates periodically and notify clients
let lastNotifiedId = 0;
setInterval(async () => {
    try {
        const filePath = path.join(process.cwd(), 'updates.json');
        console.log('Checking for updates to notify about...');
        const updates = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (updates.length > 0) {
            // Sort by newest first
            updates.sort((a, b) => b.id - a.id);
            const latestUpdate = updates[0];
            console.log(`Latest update: ID=${latestUpdate.id}, Last notified: ID=${lastNotifiedId}`);
            
            // Reset lastNotifiedId to 0 to force notifications to work again
            if (lastNotifiedId === 0) {
                console.log("First server run, setting lastNotifiedId to latest minus 1");
                // Set to one less than latest so next update triggers notification
                lastNotifiedId = Math.max(0, latestUpdate.id - 1);
            }
            
            if (latestUpdate && latestUpdate.id > lastNotifiedId) {
                notifyAllClients({ 
                    type: 'new-update',
                    update: latestUpdate
                });
                lastNotifiedId = latestUpdate.id;
                console.log(`Pushed notification for update #${latestUpdate.id} to ${clients.size} clients`);
            } else {
                console.log(`No new updates to notify about. Latest: ${latestUpdate.id}, Last notified: ${lastNotifiedId}`);
            }
        } else {
            console.log('No updates found in updates.json');
        }
    } catch (err) {
        console.error('Error in notification background task:', err);
    }
}, 5000); // Check every 5 seconds

// Serve index.html for all routes to support client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server with better error handling
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Redirect URI: ${REDIRECT_URI}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\nError: Port ${PORT} is already in use!`);
        console.error('Please try the following:');
        console.error('1. Stop any other servers that might be running');
        console.error(`2. Run: npx kill-port ${PORT}`);
        console.error('3. Try starting the server again\n');
    } else {
        console.error('Server error:', err);
    }
    process.exit(1);
}); 