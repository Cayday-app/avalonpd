// Chat Functionality
document.addEventListener('DOMContentLoaded', () => {
    // Only proceed if the user is logged in
    const token = localStorage.getItem('discord_token');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    
    if (!token || !userData.username) {
        // Display login prompt if not logged in
        const chatMain = document.querySelector('.chat-main');
        if (chatMain) {
            chatMain.innerHTML = `
                <div class="login-required">
                    <div class="login-icon">
                        <i class="fas fa-lock"></i>
                    </div>
                    <h3>Officer Login Required</h3>
                    <p>You need to be logged in as an APD officer to use the chat.</p>
                    <button onclick="handleDiscordAuth()" class="login-btn">LOGIN WITH DISCORD</button>
                </div>
            `;
        }
        return;
    }
    
    // Initialize important elements
    const messageContainer = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPicker = document.getElementById('emoji-picker');
    const mentionMenu = document.getElementById('mention-menu');
    const officerList = document.getElementById('officer-list');
    const refreshBtn = document.getElementById('refresh-btn');
    const clearBtn = document.getElementById('clear-btn');
    
    // Check if user has HR role
    const userRoles = JSON.parse(localStorage.getItem('roles') || '[]');
    const hasHRRole = userRoles.includes('905142677034016778'); // HR role ID
    
    // Add HR clear button if user has HR role
    if (hasHRRole) {
        const chatHeader = document.querySelector('.chat-header');
        const chatActions = chatHeader.querySelector('.chat-actions');
        
        const hrClearBtn = document.createElement('button');
        hrClearBtn.title = 'Clear All Messages (HR Only)';
        hrClearBtn.innerHTML = '<i class="fas fa-trash" style="color: #ff4444;"></i>';
        hrClearBtn.style.fontSize = '1.2rem';
        
        hrClearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all messages? This action cannot be undone.')) {
                fetch('/.netlify/functions/chat', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to clear messages');
                    }
                    messages = [];
                    renderMessages();
                    showToast('All messages have been cleared');
                })
                .catch(error => {
                    console.error('Error clearing messages:', error);
                    showToast('Failed to clear messages', true);
                });
            }
        });
        
        chatActions.insertBefore(hrClearBtn, chatActions.firstChild);
    }
    
    // Chat data storage
    let messages = [];
    let officers = [];
    let currentMentionFilter = '';
    let editingMessageId = null;
    
    // Initialize emoji data
    const commonEmojis = [
        '👍', '👎', '❤️', '😂', '😢', '😡', '👮', '🚓', 
        '🚨', '📱', '💻', '📋', '⚠️', '🚫', '⭐', '🔥', 
        '🎖️', '🏆', '🏅', '🥇', '💯', '✅', '❌', '💪',
        '👋', '🙌', '👏', '🤔', '🤝', '🛡️', '🔫', '🔦'
    ];
    
    // Load emojis into picker
    function loadEmojiPicker() {
        emojiPicker.innerHTML = '';
        commonEmojis.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji;
            emojiItem.addEventListener('click', () => {
                addEmoji(emoji);
                emojiPicker.classList.remove('active');
            });
            emojiPicker.appendChild(emojiItem);
        });
    }
    
    // Add emoji to input
    function addEmoji(emoji) {
        chatInput.value += emoji;
        chatInput.focus();
    }
    
    // Toggle emoji picker
    emojiBtn.addEventListener('click', () => {
        emojiPicker.classList.toggle('active');
    });
    
    // Close emoji picker when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
            emojiPicker.classList.remove('active');
        }
        
        if (!chatInput.contains(e.target) && !mentionMenu.contains(e.target)) {
            mentionMenu.classList.remove('active');
        }
    });
    
    // Handle mention functionality
    chatInput.addEventListener('input', () => {
        const text = chatInput.value;
        const cursorPos = chatInput.selectionStart;
        
        // Find the @ symbol and the text after it
        let mentionStart = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
            if (text[i] === '@') {
                mentionStart = i;
                break;
            } else if (text[i] === ' ' || text[i] === '\n') {
                break;
            }
        }
        
        if (mentionStart !== -1) {
            const mentionText = text.substring(mentionStart + 1, cursorPos).toLowerCase();
            currentMentionFilter = mentionText;
            
            // Filter officers by mention text
            const filteredOfficers = officers.filter(officer => 
                officer.username.toLowerCase().includes(mentionText)
            );
            
            if (filteredOfficers.length > 0) {
                // Show mention menu
                mentionMenu.innerHTML = '';
                filteredOfficers.forEach((officer, index) => {
                    const mentionItem = document.createElement('div');
                    mentionItem.className = 'mention-item';
                    if (index === 0) mentionItem.classList.add('selected');
                    
                    mentionItem.innerHTML = `
                        <img src="${officer.avatar}" alt="${officer.username}" class="mention-avatar">
                        <span class="mention-name">${officer.username}</span>
                    `;
                    
                    mentionItem.addEventListener('click', () => {
                        insertMention(mentionStart, cursorPos, officer.username);
                        mentionMenu.classList.remove('active');
                    });
                    
                    mentionMenu.appendChild(mentionItem);
                });
                
                mentionMenu.classList.add('active');
            } else {
                mentionMenu.classList.remove('active');
            }
        } else {
            mentionMenu.classList.remove('active');
        }
    });
    
    // Handle mention selection with keyboard
    chatInput.addEventListener('keydown', (e) => {
        if (mentionMenu.classList.contains('active')) {
            const selected = mentionMenu.querySelector('.mention-item.selected');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (selected && selected.nextElementSibling) {
                    selected.classList.remove('selected');
                    selected.nextElementSibling.classList.add('selected');
                    selected.nextElementSibling.scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (selected && selected.previousElementSibling) {
                    selected.classList.remove('selected');
                    selected.previousElementSibling.classList.add('selected');
                    selected.previousElementSibling.scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                if (selected) {
                    const username = selected.querySelector('.mention-name').textContent;
                    const cursorPos = chatInput.selectionStart;
                    
                    // Find the @ symbol
                    let mentionStart = -1;
                    for (let i = cursorPos - 1; i >= 0; i--) {
                        if (chatInput.value[i] === '@') {
                            mentionStart = i;
                            break;
                        } else if (chatInput.value[i] === ' ' || chatInput.value[i] === '\n') {
                            break;
                        }
                    }
                    
                    if (mentionStart !== -1) {
                        insertMention(mentionStart, cursorPos, username);
                    }
                    
                    mentionMenu.classList.remove('active');
                }
            } else if (e.key === 'Escape') {
                mentionMenu.classList.remove('active');
            }
        }
    });
    
    // Insert mention into input
    function insertMention(start, end, username) {
        const textBefore = chatInput.value.substring(0, start);
        const textAfter = chatInput.value.substring(end);
        chatInput.value = textBefore + '@' + username + ' ' + textAfter;
        
        // Set cursor position after the inserted mention
        const newCursorPos = start + username.length + 2; // +2 for @ and space
        chatInput.focus();
        chatInput.setSelectionRange(newCursorPos, newCursorPos);
    }
    
    // Format mentions in message
    function formatMentions(text) {
        // Replace @username with styled spans
        return text.replace(/@(\w+)/g, '<span class="message-mention">@$1</span>');
    }
    
    // Load messages from server
    function loadMessages() {
        const token = localStorage.getItem('discord_token');
        if (!token) return;

        fetch('/.netlify/functions/chat', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            messages = data;
            renderMessages();
        })
        .catch(error => {
            console.error('Error loading messages:', error);
            showToast('Failed to load messages', true);
        });
    }
    
    // Send message to server
    function sendMessage() {
        if (!chatInput.value.trim()) return;

        const token = localStorage.getItem('discord_token');
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        
        if (!token || !userData.id) {
            showToast('You must be logged in to send messages', true);
            return;
        }

        const messageData = {
            text: chatInput.value,
            authorId: userData.id,
            authorName: userData.username,
            authorAvatar: userData.avatar
        };

        fetch('/.netlify/functions/chat', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messageData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(message => {
            messages.push(message);
            renderMessages();
            chatInput.value = '';
        })
        .catch(error => {
            console.error('Error sending message:', error);
            showToast('Failed to send message', true);
        });
    }
    
    // Listen for send button click
    sendBtn.addEventListener('click', sendMessage);
    
    // Listen for Enter key (but not with Shift)
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Clear chat
    clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the chat? This will remove all messages.')) {
            messages = [];
            saveMessages();
            renderMessages();
        }
    });
    
    // Refresh chat
    refreshBtn.addEventListener('click', () => {
        loadMessages();
        loadOfficers();
    });
    
    // Edit message function
    function editMessage(id, newText) {
        fetch('/.netlify/functions/chat', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('discord_token')
            },
            body: JSON.stringify({
                id: id,
                text: newText,
                authorId: userData.id
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to edit message');
            }
            return response.json();
        })
        .then(updatedMessage => {
            const index = messages.findIndex(m => m.id === id);
            if (index !== -1) {
                messages[index] = updatedMessage;
                renderMessages();
            }
            editingMessageId = null;
        })
        .catch(error => {
            console.error('Error editing message:', error);
            showToast('Failed to edit message', true);
        });
    }
    
    // Delete message function
    function deleteMessage(id) {
        fetch(`/.netlify/functions/chat?id=${id}&authorId=${userData.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': localStorage.getItem('discord_token')
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete message');
            }
            return response.json();
        })
        .then(deletedMessage => {
            const index = messages.findIndex(m => m.id === id);
            if (index !== -1) {
                messages.splice(index, 1);
                renderMessages();
            }
        })
        .catch(error => {
            console.error('Error deleting message:', error);
            showToast('Failed to delete message', true);
        });
    }
    
    // Add reaction to message
    function addReaction(messageId, emoji) {
        const token = localStorage.getItem('discord_token');
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) {
            showToast('Message not found', true);
            return;
        }
        
        // Optimistic update
        const reactions = messages[messageIndex].reactions || [];
        const existingReactionIndex = reactions.findIndex(r => 
            r.emoji === emoji && r.userId === userData.id
        );
        
        let updatedReactions;
        if (existingReactionIndex !== -1) {
            updatedReactions = reactions.filter((_, i) => i !== existingReactionIndex);
        } else {
            updatedReactions = [...reactions, {
                emoji,
                username: userData.username,
                userId: userData.id
            }];
        }
        
        // Update UI immediately
        messages[messageIndex].reactions = updatedReactions;
        updateMessageReactions(messageId, updatedReactions);
        
        // Make API call
        fetch('/.netlify/functions/chat/' + messageId + '/reactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({
                emoji: emoji,
                username: userData.username,
                userId: userData.id
            })
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to update reaction');
            return response.json();
        })
        .then(data => {
            // Update with server data
            messages[messageIndex].reactions = data.reactions;
            updateMessageReactions(messageId, data.reactions);
        })
        .catch(error => {
            console.error('Error updating reaction:', error);
            showToast('Failed to update reaction', true);
            // Revert to original state
            messages[messageIndex].reactions = reactions;
            updateMessageReactions(messageId, reactions);
        });
    }
    
    // Update reactions for a specific message
    function updateMessageReactions(messageId, reactions) {
        try {
            // Find the message element
            const messageEl = document.querySelector(`.message[data-id="${messageId}"]`);
            if (!messageEl) return;
            
            let reactionsContainer = messageEl.querySelector('.message-reactions');
            
            // Group reactions by emoji
            const reactionsGrouped = {};
            reactions.forEach(r => {
                if (!reactionsGrouped[r.emoji]) {
                    reactionsGrouped[r.emoji] = [];
                }
                reactionsGrouped[r.emoji].push(r.username);
            });
            
            // Create new reactions HTML
            if (Object.keys(reactionsGrouped).length > 0) {
                // Create container if it doesn't exist
                if (!reactionsContainer) {
                    const newContainer = document.createElement('div');
                    newContainer.className = 'message-reactions';
                    const messageTextEl = messageEl.querySelector('.message-text');
                    if (messageTextEl) {
                        messageTextEl.after(newContainer);
                        reactionsContainer = newContainer;
                    } else {
                        return; // Can't find where to add reactions
                    }
                }
                
                // Update container content
                reactionsContainer.innerHTML = Object.entries(reactionsGrouped).map(([emoji, users]) => `
                    <div class="message-reaction" title="${users.join(', ')}" data-emoji="${emoji}" data-id="${messageId}">
                        ${emoji} <span>${users.length}</span>
                    </div>
                `).join('');
                
                // Add click events to reactions
                reactionsContainer.querySelectorAll('.message-reaction').forEach(el => {
                    el.addEventListener('click', () => {
                        const emoji = el.getAttribute('data-emoji');
                        addReaction(messageId, emoji);
                    });
                });
            } else if (reactionsContainer) {
                // Remove container if no reactions
                reactionsContainer.remove();
            }
        } catch (error) {
            console.error('Error updating reactions UI:', error);
        }
    }
    
    // Render a single message
    function appendMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message';
        messageEl.setAttribute('data-id', message.id);
        if (message.author === userData.username) {
            messageEl.classList.add('self-message');
        }
        
        // Format date
        const date = new Date(message.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString();
        
        // Format message text with mentions
        const formattedText = formatMentions(message.text);
        
        // Create reactions HTML
        let reactionsHtml = '';
        if (message.reactions && message.reactions.length > 0) {
            // Group reactions by emoji
            const reactionsGrouped = {};
            message.reactions.forEach(r => {
                if (!reactionsGrouped[r.emoji]) {
                    reactionsGrouped[r.emoji] = [];
                }
                reactionsGrouped[r.emoji].push(r.username);
            });
            
            // Create HTML for each reaction
            reactionsHtml = `
                <div class="message-reactions">
                    ${Object.entries(reactionsGrouped).map(([emoji, users]) => `
                        <div class="message-reaction" title="${users.join(', ')}" data-emoji="${emoji}" data-id="${message.id}">
                            ${emoji} <span>${users.length}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        // Create message HTML
        messageEl.innerHTML = `
            <img src="${message.avatar}" alt="${message.author}" class="message-avatar">
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${message.author}</span>
                    <span class="message-time" title="${dateStr}">${timeStr}</span>
                    ${message.edited ? '<span class="edited-indicator">(edited)</span>' : ''}
                </div>
                <div class="message-text">
                    <p>${formattedText}</p>
                </div>
                ${reactionsHtml}
                ${message.author === userData.username ? `
                <div class="message-actions">
                    <button class="message-action-btn edit-btn" data-id="${message.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="message-action-btn delete-btn" data-id="${message.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
                ` : `
                <div class="message-actions">
                    <button class="message-action-btn react-btn" data-id="${message.id}">
                        <i class="far fa-smile"></i> React
                    </button>
                </div>
                `}
            </div>
        `;
        
        // Add event listeners for actions
        messageContainer.appendChild(messageEl);
        
        // Edit button
        const editBtn = messageEl.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                editingMessageId = message.id;
                chatInput.value = message.text;
                chatInput.focus();
                sendBtn.innerHTML = '<i class="fas fa-check"></i>';
            });
        }
        
        // Delete button
        const deleteBtn = messageEl.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                deleteMessage(message.id);
            });
        }
        
        // React button
        const reactBtn = messageEl.querySelector('.react-btn');
        if (reactBtn) {
            reactBtn.addEventListener('click', () => {
                // Show emoji picker for reaction
                const emojiSelector = document.createElement('div');
                emojiSelector.className = 'emoji-reaction-selector';
                emojiSelector.innerHTML = commonEmojis.map(emoji => 
                    `<span class="emoji-reaction-item" data-emoji="${emoji}">${emoji}</span>`
                ).join('');
                
                // Position near the button
                const rect = reactBtn.getBoundingClientRect();
                emojiSelector.style.position = 'absolute';
                emojiSelector.style.top = `${rect.bottom + 10}px`;
                emojiSelector.style.left = `${rect.left}px`;
                emojiSelector.style.background = 'var(--primary)';
                emojiSelector.style.padding = '10px';
                emojiSelector.style.borderRadius = '8px';
                emojiSelector.style.display = 'flex';
                emojiSelector.style.flexWrap = 'wrap';
                emojiSelector.style.gap = '5px';
                emojiSelector.style.maxWidth = '200px';
                emojiSelector.style.boxShadow = '0 5px 20px rgba(0,0,0,0.3)';
                emojiSelector.style.zIndex = '1000';
                
                document.body.appendChild(emojiSelector);
                
                // Add click events to emojis
                emojiSelector.querySelectorAll('.emoji-reaction-item').forEach(el => {
                    el.addEventListener('click', () => {
                        const emoji = el.getAttribute('data-emoji');
                        addReaction(message.id, emoji);
                        emojiSelector.remove();
                    });
                });
                
                // Remove on click outside
                document.addEventListener('click', function removeSelector(e) {
                    if (!emojiSelector.contains(e.target) && e.target !== reactBtn) {
                        emojiSelector.remove();
                        document.removeEventListener('click', removeSelector);
                    }
                });
            });
        }
        
        // Add click events to reactions
        messageEl.querySelectorAll('.message-reaction').forEach(el => {
            el.addEventListener('click', () => {
                const messageId = parseInt(el.getAttribute('data-id'));
                const emoji = el.getAttribute('data-emoji');
                addReaction(messageId, emoji);
            });
        });
    }
    
    // Render all messages
    function renderMessages() {
        // Clear container except welcome message
        const welcomeMessage = messageContainer.querySelector('.welcome-message');
        messageContainer.innerHTML = '';
        if (welcomeMessage) {
            messageContainer.appendChild(welcomeMessage);
        }
        
        // Add all messages
        messages.forEach(message => {
            appendMessage(message);
        });
        
        // Scroll to bottom
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
    
    // Save messages to localStorage
    function saveMessages() {
        localStorage.setItem('chat_messages', JSON.stringify(messages));
    }
    
    // Render officers in sidebar
    function renderOfficers() {
        officerList.innerHTML = '';
        
        // Sort online officers first
        officers.sort((a, b) => {
            if (a.online && !b.online) return -1;
            if (!a.online && b.online) return 1;
            return 0;
        });
        
        officers.forEach(officer => {
            const officerEl = document.createElement('div');
            officerEl.className = 'officer-item';
            
            officerEl.innerHTML = `
                <img src="${officer.avatar}" alt="${officer.username}" class="officer-avatar">
                <div class="officer-info">
                    <div class="officer-name">${officer.username}</div>
                    <div class="officer-status ${officer.online ? 'online' : ''}">
                        ${officer.online ? 'Online' : 'Offline'}
                    </div>
                </div>
            `;
            
            officerList.appendChild(officerEl);
        });
        
        // Update online count
        const onlineCount = officers.filter(o => o.online).length;
        document.getElementById('online-count').textContent = onlineCount;
    }
    
    // Function to load officers (simple initialization)
    function loadOfficers() {
        // Check if this user has the APD role (required for chat)
        const userRoles = JSON.parse(localStorage.getItem('roles') || '[]');
        const requiredRoles = config.discord.requiredRoles || [];
        const hasAPDRole = userRoles.some(role => requiredRoles.includes(role));
        
        if (!hasAPDRole) {
            // User doesn't have the proper role, display a message
            const chatMain = document.querySelector('.chat-main');
            if (chatMain) {
                chatMain.innerHTML = `
                    <div class="login-required">
                        <div class="login-icon">
                            <i class="fas fa-exclamation-circle"></i>
                        </div>
                        <h3>APD Role Required</h3>
                        <p>You need to have the APD role in the Discord server to use the chat.</p>
                        <p>Please contact an administrator if you believe this is an error.</p>
                    </div>
                `;
            }
            return;
        }
        
        // Initial render with empty list - will be populated by fetchActiveOfficers
        renderOfficers();
    }
    
    // Fetch active users with APD role from server
    async function fetchActiveOfficers() {
        try {
            // Simulate a server with shared localStorage for active users
            const userRoles = JSON.parse(localStorage.getItem('roles') || '[]');
            const requiredRoles = config.discord.requiredRoles || [];
            const hasAPDRole = userRoles.some(role => requiredRoles.includes(role));
            
            if (hasAPDRole) {
                // First, register this user as active
                await registerActiveUser();
                
                // Then fetch all active users
                const response = await fetch('/.netlify/functions/discord-status');
                if (!response.ok) {
                    throw new Error('Failed to fetch active users');
                }
                
                const activeOfficers = await response.json();
                console.log("Active officers from server:", activeOfficers);
                
                // In a real app, we'd save this to a server
                // For demo, we'll just set officers directly
                officers = activeOfficers.map(officer => ({
                    username: officer.username,
                    avatar: officer.avatar,
                    online: true,
                    id: officer.id
                }));
                
                console.log("Active officers:", officers);
                
                // Update localStorage and UI
                localStorage.setItem('chat_officers', JSON.stringify(officers));
                renderOfficers();
                
                // In a production app, we would also add:
                // 1. WebSocket connection to server for real-time updates
                // 2. Server endpoint to register user presence
                // 3. Server endpoint to fetch all online users
            }
            
        } catch (error) {
            console.error('Error fetching active officers:', error);
        }
    }
    
    // Register active user
    async function registerActiveUser() {
        const token = localStorage.getItem('discord_token');
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        
        if (!token || !userData.id) return;

        try {
            const response = await fetch('/.netlify/functions/discord-status', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userData.id,
                    username: userData.username,
                    avatar: userData.avatar
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Start heartbeat after successful registration
            startHeartbeat();
        } catch (error) {
            console.error('Error registering user:', error);
            setTimeout(registerActiveUser, 5000); // Retry after 5 seconds
        }
    }
    
    // Check if officers data exists in localStorage
    const savedOfficers = localStorage.getItem('chat_officers');
    if (savedOfficers) {
        officers = JSON.parse(savedOfficers);
    }
    
    // Initialize chat
    loadEmojiPicker();
    loadMessages();
    loadOfficers();
    fetchActiveOfficers();
    
    // Set up event source for real-time updates
    const eventSource = new EventSource('/.netlify/functions/notifications');
    
    eventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('SSE message:', data);
            
            // Handle different notification types
            if (data.type === 'new-message') {
                // Check if we already have this message (to avoid duplicates)
                if (!messages.some(m => m.id === data.message.id)) {
                    // Add new message to chat
                    messages.push(data.message);
                    appendMessage(data.message);
                    // Auto-scroll to bottom for new messages
                    messageContainer.scrollTop = messageContainer.scrollHeight;
                }
            } 
            else if (data.type === 'edit-message') {
                // Update edited message
                const messageIndex = messages.findIndex(m => m.id === data.message.id);
                if (messageIndex !== -1) {
                    messages[messageIndex] = data.message;
                    renderMessages(); // Re-render all messages (could optimize to just update this one)
                }
            }
            else if (data.type === 'delete-message') {
                // Remove deleted message
                messages = messages.filter(m => m.id !== data.messageId);
                
                // Remove from DOM directly instead of re-rendering
                const messageEl = document.querySelector(`.message[data-id="${data.messageId}"]`);
                if (messageEl) {
                    messageEl.remove();
                } else {
                    renderMessages(); // Fallback to full render if element not found
                }
            }
            else if (data.type === 'reaction-change') {
                // Update reactions without re-rendering whole message list
                updateMessageReactions(data.messageId, data.reactions);
            }
            else if (data.type === 'user-active' || data.type === 'user-inactive') {
                // User presence updates are handled by fetchActiveOfficers
                fetchActiveOfficers();
            }
            else if (data.type === 'clear-chat') {
                // Clear all messages from the chat
                messages = [];
                renderMessages();
                showToast('Chat has been cleared automatically');
            }
        } catch (error) {
            console.error('Error processing SSE event:', error);
        }
    };
    
    eventSource.onerror = function(err) {
        console.error('EventSource error:', err);
    };
    
    // Periodically check for active officers
    setInterval(() => {
        // Fetch active officers every 30 seconds instead of 15
        sendHeartbeat();
        fetchActiveOfficers();
    }, 30000); // Reduced frequency to avoid overwhelming the server
    
    // Send heartbeat to keep user active
    async function sendHeartbeat() {
        try {
            await fetch('/.netlify/functions/discord-status/' + userData.id, { method: 'PUT' });
        } catch (error) {
            console.error('Error sending heartbeat:', error);
        }
    }
    
    // Set up "unload" handler to remove user when leaving
    window.addEventListener('beforeunload', async () => {
        try {
            // Make a synchronous request to remove user on page close
            const xhr = new XMLHttpRequest();
            xhr.open('DELETE', '/.netlify/functions/discord-status/' + userData.id, false);
            xhr.send();
        } catch (e) {
            console.error('Error removing user on page close:', e);
        }
    });
    
    // Create a simple toast notification function
    function showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.className = 'message-toast';
        toast.textContent = message;
        toast.style.backgroundColor = isError ? '#d9534f' : '#5cb85c';
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    // Helper to remove a message by ID
    function removeMessageById(id) {
        // Remove from array
        messages = messages.filter(m => m.id !== id);
        
        // Remove from DOM
        const messageEl = document.querySelector(`.message[data-id="${id}"]`);
        if (messageEl) {
            messageEl.remove();
        }
    }
}); 