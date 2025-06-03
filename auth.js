// Auth handling
document.addEventListener('DOMContentLoaded', function() {
    // Initialize auth
    initializeAuth();
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
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        handleAuthCode(code);
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
    const clientId = '1363747847039881347'; // This should match your Netlify env var
    const redirectUri = encodeURIComponent(window.location.origin);
    const scopes = encodeURIComponent('identify guilds guilds.members.read');
    const guildId = '1363747433074655433'; // Add guild ID for proper authorization
    
    const authUrl = `https://discord.com/oauth2/authorize` + 
        `?client_id=${clientId}` +
        `&redirect_uri=${redirectUri}` +
        `&response_type=code` +
        `&scope=${scopes}` +
        `&guild_id=${guildId}` + // Add guild ID to pre-select server
        `&prompt=consent`;
    
    window.location.href = authUrl;
}

// Handle the authorization code from Discord
async function handleAuthCode(code) {
    try {
        showToast('Authenticating...');
        
        // Test the hello function first
        console.log('Testing hello function...');
        try {
            const testResponse = await fetch('/.netlify/functions/hello');
            const testData = await testResponse.text();
            console.log('Hello function response:', testData);
        } catch (testError) {
            console.error('Hello function test failed:', testError);
        }
        
        console.log('Starting authentication process...');
        const response = await fetch('/.netlify/functions/discord-auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });
        
        console.log('Response status:', response.status);
        const contentType = response.headers.get('content-type');
        console.log('Response content type:', contentType);
        
        if (!response.ok) {
            const text = await response.text();
            console.error('Auth response error:', {
                status: response.status,
                statusText: response.statusText,
                body: text
            });
            throw new Error(text || 'Authentication failed');
        }
        
        const data = await response.json();
        console.log('Authentication response received:', data);
        
        if (!data.token || !data.userData) {
            console.error('Invalid response data:', data);
            throw new Error('Invalid authentication response');
        }
        
        // Store the data
        localStorage.setItem('discord_token', data.token);
        localStorage.setItem('user_data', JSON.stringify(data.userData));
        localStorage.setItem('roles', JSON.stringify(data.roles));
        localStorage.setItem('has_access', data.hasAccess ? 'true' : 'false');
        localStorage.setItem('creator_role', data.creatorRole);
        
        // Update UI
        updateLoginState();
        updateRestrictedNav();
        
        // Clean up URL
        window.history.replaceState({}, document.title, '/');
        showToast('Successfully logged in!');
        
    } catch (error) {
        console.error('Authentication error:', error);
        showToast(error.message || 'Authentication failed', true);
        localStorage.removeItem('discord_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('roles');
        localStorage.removeItem('has_access');
        localStorage.removeItem('creator_role');
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
    const hasAccess = localStorage.getItem('has_access') === 'true';
    const userRoles = JSON.parse(localStorage.getItem('roles') || '[]');
    
    const restrictedNavItems = document.querySelectorAll('.restricted-nav');
    restrictedNavItems.forEach(item => {
        item.style.display = (token && hasAccess) ? 'block' : 'none';
    });
    
    // We'll get the creator role from the server response
    const restrictedCreateItems = document.querySelectorAll('.restricted-create');
    const hasCreatorRole = userRoles.includes(localStorage.getItem('creator_role'));
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