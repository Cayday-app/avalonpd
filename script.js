// Discord configuration
const config = {
    discord: {
        clientId: '1363747847039881347',
        guildId: '1363747433074655433',
        requiredRoles: ['1363749144266674267'],
        creatorRole: '1363771721177628692',
        redirectUri: 'https://avalonpd.netlify.app/auth/callback'
    }
};

// Handle loading screen
document.addEventListener('readystatechange', () => {
    if (document.readyState === 'complete') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 500);
        }
    }
});

// Handle Discord Authentication
function handleDiscordAuth() {
    const scopes = encodeURIComponent('identify guilds guilds.members.read');
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('discord_auth_state', state);
    
    const authUrl = `https://discord.com/oauth2/authorize` + 
        `?client_id=${config.discord.clientId}` +
        `&redirect_uri=${encodeURIComponent(config.discord.redirectUri)}` +
        `&response_type=token` +
        `&scope=${scopes}` +
        `&state=${state}` +
        `&guild_id=${config.discord.guildId}` +
        `&prompt=consent`;
    
    window.location.href = authUrl;
}

// Handle the authorization token from Discord
async function handleAuthToken(accessToken, tokenType) {
    try {
        // Verify state to prevent CSRF attacks
        const storedState = localStorage.getItem('discord_auth_state');
        const urlState = new URLSearchParams(window.location.hash.slice(1)).get('state');
        
        if (!storedState || storedState !== urlState) {
            throw new Error('Invalid state parameter');
        }
        
        localStorage.removeItem('discord_auth_state');
        localStorage.setItem('discord_token', accessToken);
        
        // Fetch user data
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                'Authorization': `${tokenType} ${accessToken}`
            }
        });
        
        if (!userResponse.ok) throw new Error('Failed to fetch user data');
        const userData = await userResponse.json();
        localStorage.setItem('user_data', JSON.stringify(userData));
        
        // Fetch guild member data
        const guildId = config.discord.guildId;
        const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
            headers: {
                'Authorization': `${tokenType} ${accessToken}`
            }
        });
        
        if (!memberResponse.ok) throw new Error('Failed to fetch member data');
        const memberData = await memberResponse.json();
        
        // Check roles
        const roles = memberData.roles || [];
        localStorage.setItem('roles', JSON.stringify(roles));
        
        const hasAccess = roles.some(role => 
            config.discord.requiredRoles.includes(role)
        );
        localStorage.setItem('has_access', hasAccess ? 'true' : 'false');
        
        // Update UI
        updateLoginButton(userData);
        if (hasAccess) {
            unlockRestrictedContent();
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, '/');
        
    } catch (error) {
        console.error('Authentication error:', error);
        localStorage.removeItem('discord_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('roles');
        localStorage.removeItem('has_access');
    }
}

// Update login button with user profile
function updateLoginButton(userData) {
    const loginBtn = document.querySelector('.login-btn');
    if (loginBtn) {
        loginBtn.innerHTML = `
            <img src="${userData.avatar 
                ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
                : 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                alt="${userData.username}" 
                style="width: 24px; height: 24px; border-radius: 50%;">
            <span>${userData.username}</span>
        `;
        loginBtn.onclick = logout;
    }
}

// Function to unlock restricted content
function unlockRestrictedContent() {
    document.querySelectorAll('.restricted-nav').forEach(item => {
        item.style.display = 'block';
    });
}

// Logout function
function logout() {
    localStorage.removeItem('discord_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('has_access');
    localStorage.removeItem('roles');
    window.location.reload();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Restore login state
    const token = localStorage.getItem('discord_token');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    const hasAccess = localStorage.getItem('has_access') === 'true';
    
    if (userData.username) {
        updateLoginButton(userData);
    }
    if (hasAccess) {
        unlockRestrictedContent();
    }

    // Handle OAuth token in URL hash
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const [accessToken, tokenType] = [fragment.get('access_token'), fragment.get('token_type')];
    
    if (accessToken) {
        handleAuthToken(accessToken, tokenType);
    }
});