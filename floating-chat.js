// Floating Chat Component
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const token = localStorage.getItem('discord_token');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    const userRoles = JSON.parse(localStorage.getItem('roles') || '[]');
    const requiredRoles = window.config?.discord?.requiredRoles || [];
    
    // Only show chat for logged in users with proper roles
    const hasAPDRole = userRoles.some(role => requiredRoles.includes(role));
    
    if (!token || !userData.username || !hasAPDRole) {
        // Don't show chat if not logged in or without proper role
        return;
    }
    
    // Create floating chat structure
    const floatingChat = document.createElement('div');
    floatingChat.className = 'floating-chat';
    
    // Check if user has HR role
    const hasHRRole = userRoles.includes('905142677034016778'); // HR role ID
    
    floatingChat.innerHTML = `
        <div class="floating-chat-header">
            <div class="chat-title">LIVE CHAT</div>
            <div class="chat-controls">
                ${hasHRRole ? `
                <button class="hr-clear-btn" title="Clear All Messages (HR Only)">
                    <i class="fas fa-trash" style="color: #ff4444;"></i>
                </button>
                ` : ''}
                <button class="minimize-btn" title="Minimize"><i class="fas fa-minus"></i></button>
                <button class="expand-btn" title="Expand"><i class="fas fa-expand"></i></button>
            </div>
        </div>
        <div class="floating-chat-body">
            <div class="floating-chat-messages" id="floating-chat-messages">
                <div class="welcome-message">
                    <div class="welcome-icon">
                        <img src="apdlogo.png" alt="APD">
                    </div>
                    <div class="welcome-text">
                        <h3>Welcome to APD Live Chat</h3>
                        <p>Messages are shared with all online officers. Be professional.</p>
                    </div>
                </div>
            </div>
            <div class="floating-chat-input-container">
                <div class="floating-chat-input-wrapper">
                    <textarea id="floating-chat-input" placeholder="Type a message..."></textarea>
                    <div class="floating-chat-buttons">
                        <button id="floating-emoji-btn" class="emoji-button"><i class="far fa-smile"></i></button>
                        <button id="floating-send-btn" class="send-button"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
                <div id="floating-emoji-picker" class="emoji-picker"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(floatingChat);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .floating-chat {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 350px;
            height: 450px;
            background: var(--primary);
            border-radius: 12px;
            box-shadow: 0 5px 25px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            z-index: 1000;
            transition: all 0.3s ease;
            overflow: hidden;
        }
        
        .floating-chat.minimized {
            height: 50px;
        }
        
        .floating-chat.expanded {
            width: 80vw;
            height: 80vh;
            top: 10vh;
            left: 10vw;
            right: auto;
            bottom: auto;
        }
        
        .floating-chat-header {
            padding: 12px 15px;
            background: rgba(0, 0, 0, 0.2);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: grab;
        }
        
        .chat-title {
            font-weight: 600;
            color: var(--accent);
        }
        
        .chat-controls {
            display: flex;
            gap: 8px;
        }
        
        .chat-controls button {
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.6);
            cursor: pointer;
            font-size: 0.9rem;
            transition: color 0.2s;
            padding: 4px;
        }
        
        .chat-controls button:hover {
            color: var(--accent);
        }
        
        .floating-chat-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .floating-chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .floating-chat-input-container {
            padding: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            position: relative;
        }
        
        .floating-chat-input-wrapper {
            display: flex;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 8px 12px;
        }
        
        #floating-chat-input {
            flex: 1;
            background: none;
            border: none;
            color: var(--text);
            font-family: 'Inter', sans-serif;
            font-size: 0.95rem;
            resize: none;
            padding: 5px 0;
            outline: none;
            max-height: 100px;
        }
        
        .floating-chat-buttons {
            display: flex;
            align-items: flex-end;
            gap: 8px;
        }
        
        .emoji-button, .send-button {
            background: none;
            border: none;
            cursor: pointer;
            color: rgba(255, 255, 255, 0.6);
            font-size: 1.1rem;
            transition: color 0.2s;
            padding: 4px;
        }
        
        .emoji-button:hover, .send-button:hover {
            color: var(--accent);
        }
        
        .welcome-message {
            display: flex;
            background: rgba(255, 255, 255, 0.05);
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 15px;
            gap: 12px;
        }
        
        .welcome-icon {
            width: 50px;
            height: 50px;
            border-radius: 10px;
            background: var(--accent);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        
        .welcome-icon img {
            width: 70%;
            height: 70%;
            object-fit: contain;
        }
        
        .welcome-text h3 {
            margin: 0 0 8px;
            color: var(--accent);
            font-size: 1rem;
        }
        
        .welcome-text p {
            margin: 0;
            opacity: 0.8;
            font-size: 0.9rem;
        }
        
        .minimized .floating-chat-body {
            display: none;
        }
        
        .floating-message {
            display: flex;
            gap: 10px;
            animation: fadeIn 0.3s ease-out;
        }
        
        .floating-message-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        
        .floating-message-content {
            flex: 1;
        }
        
        .floating-message-header {
            display: flex;
            align-items: baseline;
            gap: 6px;
            margin-bottom: 4px;
        }
        
        .floating-message-author {
            font-weight: 600;
            color: var(--accent);
            font-size: 0.9rem;
        }
        
        .floating-message-time {
            font-size: 0.75rem;
            opacity: 0.6;
        }
        
        .floating-message-text {
            background: rgba(255, 255, 255, 0.05);
            padding: 10px 12px;
            border-radius: 0 10px 10px 10px;
            font-size: 0.9rem;
        }
        
        .floating-message-text p {
            margin: 0;
            word-break: break-word;
        }
        
        .self-message {
            align-self: flex-end;
        }
        
        .self-message .floating-message-text {
            background: rgba(52, 152, 219, 0.2);
            border-radius: 10px 0 10px 10px;
        }
    `;
    
    document.head.appendChild(style);
    
    // Get DOM elements
    const minimizeBtn = floatingChat.querySelector('.minimize-btn');
    const expandBtn = floatingChat.querySelector('.expand-btn');
    const chatHeader = floatingChat.querySelector('.floating-chat-header');
    const chatInput = floatingChat.querySelector('#floating-chat-input');
    const sendBtn = floatingChat.querySelector('#floating-send-btn');
    const emojiBtn = floatingChat.querySelector('#floating-emoji-btn');
    const emojiPicker = floatingChat.querySelector('#floating-emoji-picker');
    const messagesContainer = floatingChat.querySelector('#floating-chat-messages');
    
    // Common emojis
    const commonEmojis = [
        '👍', '👎', '❤️', '😂', '😢', '😡', '👮', '🚓', 
        '🚨', '📱', '💻', '📋', '⚠️', '🚫', '⭐', '🔥'
    ];
    
    // Load emojis into picker
    function loadEmojiPicker() {
        emojiPicker.innerHTML = '';
        emojiPicker.style.display = 'none';
        emojiPicker.style.position = 'absolute';
        emojiPicker.style.bottom = '100%';
        emojiPicker.style.right = '10px';
        emojiPicker.style.background = 'var(--primary)';
        emojiPicker.style.borderRadius = '8px';
        emojiPicker.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.3)';
        emojiPicker.style.padding = '10px';
        emojiPicker.style.display = 'grid';
        emojiPicker.style.gridTemplateColumns = 'repeat(8, 1fr)';
        emojiPicker.style.gap = '5px';
        emojiPicker.style.maxWidth = '300px';
        emojiPicker.style.zIndex = '100';
        
        commonEmojis.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.style.width = '30px';
            emojiItem.style.height = '30px';
            emojiItem.style.fontSize = '1.4rem';
            emojiItem.style.display = 'flex';
            emojiItem.style.alignItems = 'center';
            emojiItem.style.justifyContent = 'center';
            emojiItem.style.cursor = 'pointer';
            emojiItem.style.transition = 'transform 0.2s';
            emojiItem.textContent = emoji;
            emojiItem.addEventListener('click', () => {
                addEmoji(emoji);
                emojiPicker.style.display = 'none';
            });
            emojiItem.addEventListener('mouseover', () => {
                emojiItem.style.transform = 'scale(1.2)';
            });
            emojiItem.addEventListener('mouseout', () => {
                emojiItem.style.transform = 'scale(1)';
            });
            emojiPicker.appendChild(emojiItem);
        });
    }
    
    // Add emoji to input
    function addEmoji(emoji) {
        chatInput.value += emoji;
        chatInput.focus();
    }
    
    // Initialize emoji picker
    loadEmojiPicker();
    
    // Event listeners
    minimizeBtn.addEventListener('click', () => {
        floatingChat.classList.toggle('minimized');
    });
    
    expandBtn.addEventListener('click', () => {
        floatingChat.classList.toggle('expanded');
    });
    
    // Add HR clear button functionality if user has HR role
    if (hasHRRole) {
        const hrClearBtn = floatingChat.querySelector('.hr-clear-btn');
        hrClearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all messages? This action cannot be undone.')) {
                fetch('/api/chat/messages', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to clear messages');
                    }
                    // The server will notify all clients via SSE
                })
                .catch(error => {
                    console.error('Error clearing messages:', error);
                });
            }
        });
    }
    
    emojiBtn.addEventListener('click', () => {
        emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'grid' : 'none';
    });
    
    document.addEventListener('click', (e) => {
        if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
            emojiPicker.style.display = 'none';
        }
    });
    
    // Make chat draggable
    let isDragging = false;
    let offsetX, offsetY;
    
    chatHeader.addEventListener('mousedown', (e) => {
        if (floatingChat.classList.contains('expanded')) return;
        
        isDragging = true;
        offsetX = e.clientX - floatingChat.getBoundingClientRect().left;
        offsetY = e.clientY - floatingChat.getBoundingClientRect().top;
        chatHeader.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        floatingChat.style.left = `${e.clientX - offsetX}px`;
        floatingChat.style.top = `${e.clientY - offsetY}px`;
        floatingChat.style.right = 'auto';
        floatingChat.style.bottom = 'auto';
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        chatHeader.style.cursor = 'grab';
    });
    
    // Load messages from server
    function loadMessages() {
        fetch('/api/chat/messages')
            .then(response => response.json())
            .then(messages => {
                // Display last 20 messages
                const recentMessages = messages.slice(-20);
                recentMessages.forEach(message => {
                    appendMessage(message);
                });
                
                // Scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            })
            .catch(error => {
                console.error('Error loading messages:', error);
            });
    }
    
    // Append a message to the chat
    function appendMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.className = 'floating-message';
        messageEl.setAttribute('data-id', message.id);
        
        if (message.authorId === userData.id) {
            messageEl.classList.add('self-message');
        }
        
        // Format date
        const date = new Date(message.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Create message HTML
        messageEl.innerHTML = `
            <img src="${message.avatar}" alt="${message.author}" class="floating-message-avatar">
            <div class="floating-message-content">
                <div class="floating-message-header">
                    <span class="floating-message-author">${message.author}</span>
                    <span class="floating-message-time">${timeStr}</span>
                </div>
                <div class="floating-message-text">
                    <p>${message.text}</p>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(messageEl);
    }
    
    // Send message function
    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        
        // Show sending indicator
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        sendBtn.disabled = true;
        
        fetch('/api/chat/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                author: userData.username,
                authorId: userData.id,
                avatar: userData.avatar 
                    ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` 
                    : 'https://cdn.discordapp.com/embed/avatars/0.png',
                text: text
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to send message');
            }
            return response.json();
        })
        .then(() => {
            // Server will notify all clients via SSE
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            sendBtn.disabled = false;
        })
        .catch(error => {
            console.error('Error sending message:', error);
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            sendBtn.disabled = false;
        });
        
        // Clear input
        chatInput.value = '';
    }
    
    // Listen for send button click
    sendBtn.addEventListener('click', sendMessage);
    
    // Listen for Enter key
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Set up SSE for real-time updates
    const eventSource = new EventSource('/api/notifications/stream');
    
    eventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'new-message') {
                // Check if we already have this message to avoid duplicates
                if (!document.querySelector(`.floating-message[data-id="${data.message.id}"]`)) {
                    appendMessage(data.message);
                    // Auto-scroll to bottom for new messages
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }
            else if (data.type === 'clear-chat') {
                // Clear all messages from the floating chat
                messagesContainer.innerHTML = '';
                
                // Re-add welcome message
                const welcomeMessage = document.createElement('div');
                welcomeMessage.className = 'welcome-message';
                welcomeMessage.innerHTML = `
                    <div class="welcome-icon">
                        <img src="apdlogo.png" alt="APD">
                    </div>
                    <div class="welcome-text">
                        <h3>Welcome to APD Live Chat</h3>
                        <p>Messages are shared with all online officers. Be professional.</p>
                    </div>
                `;
                messagesContainer.appendChild(welcomeMessage);
            }
        } catch (error) {
            console.error('Error processing SSE event:', error);
        }
    };
    
    // Load initial messages
    loadMessages();
}); 