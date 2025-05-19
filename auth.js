// Auth handling
document.addEventListener('DOMContentLoaded', function() {
    // Load config from config.json
    fetch('/config.json')
        .then(response => response.json())
        .then(loadedConfig => {
            window.config = loadedConfig;
            initializeAuth();
        })
        .catch(error => {
            console.error('Failed to load config:', error);
            // Fallback to default config
            window.config = {
                discord: {
                    clientId: '1363747847039881347',
                    guildId: '1363747433074655433',
                    requiredRoles: ['1363749144266674267'],
                    creatorRole: '1363771721177628692',
                    redirectUri: 'https://avalonpd.netlify.app'
                }
            };
            initializeAuth();
        });
});

function initializeAuth() {
    // Check login state
    const token = localStorage.getItem('discord_token');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    
    // Update UI based on login state
    updateLoginState();
    
    // Update restricted nav visibility
    updateRestrictedNav();
    
    // Hide loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        setTimeout(() => {
            loadingOverlay.style.opacity = 0;
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 300);
        }, 500);
    }
    
    // Handle OAuth code if present
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const [accessToken, tokenType] = [fragment.get('access_token'), fragment.get('token_type')];
    
    if (accessToken) {
        handleAuthToken(accessToken, tokenType);
    }
}

// Update login button
function updateLoginState() {
    const token = localStorage.getItem('discord_token');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    const loginBtn = document.querySelector('.login-btn');
    
    if (loginBtn) {
        if (token && userData.username) {
            // User is logged in
            loginBtn.innerHTML = `
                <img src="${userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                    alt="${userData.username}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">
                ${userData.username}
            `;
            loginBtn.onclick = handleLogout;
        } else {
            // User is not logged in
            loginBtn.textContent = 'LOGIN WITH DISCORD';
            loginBtn.onclick = handleDiscordAuth;
        }
    }
}

// Handle Discord auth
function handleDiscordAuth() {
    const config = window.config.discord;
    const scopes = encodeURIComponent('identify guilds guilds.members.read');
    
    const authUrl = `https://discord.com/oauth2/authorize` + 
        `?client_id=${config.clientId}` +
        `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
        `&response_type=token` +
        `&scope=${scopes}` +
        `&guild_id=${config.guildId}` +
        `&prompt=consent`;
    
    window.location.href = authUrl;
}

// Handle the authorization token from Discord
async function handleAuthToken(accessToken, tokenType) {
    try {
        showToast('Authenticating...');
        
        // Store the token
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
        const guildId = window.config.discord.guildId;
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
            window.config.discord.requiredRoles.includes(role)
        );
        localStorage.setItem('has_access', hasAccess ? 'true' : 'false');
        
        // Update UI
        updateLoginState();
        updateRestrictedNav();
        
        // Clean up URL
        window.history.replaceState({}, document.title, '/');
        showToast('Successfully logged in!');
        
    } catch (error) {
        console.error('Authentication error:', error);
        showToast('Authentication failed: ' + error.message, true);
        localStorage.removeItem('discord_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('roles');
        localStorage.removeItem('has_access');
    }
}

// Handle logout
function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        localStorage.removeItem('discord_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('roles');
        localStorage.removeItem('has_access');
        
        updateLoginState();
        updateRestrictedNav();
        
        showToast('Successfully logged out');
        setTimeout(() => window.location.reload(), 1000);
    }
}

// Update restricted nav visibility
function updateRestrictedNav() {
    const token = localStorage.getItem('discord_token');
    const userRoles = JSON.parse(localStorage.getItem('roles') || '[]');
    const hasAccess = localStorage.getItem('has_access') === 'true';
    
    const restrictedNavItems = document.querySelectorAll('.restricted-nav');
    restrictedNavItems.forEach(item => {
        item.style.display = (token && hasAccess) ? 'block' : 'none';
    });
    
    const restrictedCreateItems = document.querySelectorAll('.restricted-create');
    const hasCreatorRole = userRoles.includes(window.config.discord.creatorRole);
    restrictedCreateItems.forEach(item => {
        item.style.display = (token && hasCreatorRole) ? 'block' : 'none';
    });
}

// Toast notification helper
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }, 100);
}

// Add event listener to theme button
const themeBtn = document.getElementById('theme-btn');
const themeModal = document.getElementById('theme-modal');

if (themeBtn && themeModal) {
    themeBtn.addEventListener('click', function() {
        themeModal.style.display = 'flex';
    });
    
    // Close theme modal
    const closeThemeModal = document.getElementById('close-theme-modal');
    if (closeThemeModal) {
        closeThemeModal.addEventListener('click', function() {
            themeModal.style.display = 'none';
        });
    }
    
    // Apply theme
    const applyThemeBtn = document.getElementById('apply-theme-btn');
    if (applyThemeBtn) {
        applyThemeBtn.addEventListener('click', function() {
            const color1 = document.getElementById('theme-color1').value;
            const color2 = document.getElementById('theme-color2').value;
            const themeType = document.querySelector('input[name="theme-type"]:checked').value;
            
            updateTheme(color1, color2, themeType);
            themeModal.style.display = 'none';
        });
    }
}

// Load saved theme
loadSavedTheme();

// Update theme
function updateTheme(color1, color2, themeType) {
    const root = document.documentElement;
    
    if (themeType === 'solid') {
        root.style.setProperty('--primary', color1);
        root.style.setProperty('--accent', color2);
        root.style.setProperty('--background', darkenColor(color1, 20));
    } else {
        // Gradient theme
        root.style.setProperty('--primary', color1);
        root.style.setProperty('--accent', color2);
        root.style.setProperty('--background', `linear-gradient(135deg, ${color1}, ${darkenColor(color1, 20)})`);
    }
    
    // Save theme
    localStorage.setItem('theme', JSON.stringify({
        color1,
        color2,
        themeType
    }));
}

// Load saved theme
function loadSavedTheme() {
    const savedTheme = JSON.parse(localStorage.getItem('theme') || 'null');
    
    if (savedTheme) {
        updateTheme(savedTheme.color1, savedTheme.color2, savedTheme.themeType);
        
        // Update theme picker
        const color1Input = document.getElementById('theme-color1');
        const color2Input = document.getElementById('theme-color2');
        const themeTypeInputs = document.querySelectorAll('input[name="theme-type"]');
        
        if (color1Input) color1Input.value = savedTheme.color1;
        if (color2Input) color2Input.value = savedTheme.color2;
        
        themeTypeInputs.forEach(input => {
            if (input.value === savedTheme.themeType) {
                input.checked = true;
            }
        });
    }
}

// Helper: Darken color
function darkenColor(color, percent) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = Math.floor(R * (100 - percent) / 100);
    G = Math.floor(G * (100 - percent) / 100);
    B = Math.floor(B * (100 - percent) / 100);

    R = (R < 255) ? R : 255;
    G = (G < 255) ? G : 255;
    B = (B < 255) ? B : 255;

    const RR = ((R.toString(16).length === 1) ? '0' + R.toString(16) : R.toString(16));
    const GG = ((G.toString(16).length === 1) ? '0' + G.toString(16) : G.toString(16));
    const BB = ((B.toString(16).length === 1) ? '0' + B.toString(16) : B.toString(16));

    return '#' + RR + GG + BB;
} 