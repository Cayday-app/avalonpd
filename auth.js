// Auth handling
document.addEventListener('DOMContentLoaded', function() {
    // Load config
    const defaultConfig = {
        discord: {
            clientId: '1363747847039881347',
            requiredRoles: ['905142674228772905'] // APD role ID
        }
    };
    
    window.config = window.config || defaultConfig;
    
    // Check login state
    const token = localStorage.getItem('discord_token');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    const userRoles = JSON.parse(localStorage.getItem('roles') || '[]');
    
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
});

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
    const clientId = '1363747847039881347';  // Use direct value since we know it
    const redirectUri = 'http://localhost:3000';  // Use direct value to ensure correct format
    const scope = 'identify guilds';
    
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    
    window.location.href = authUrl;
}

// Handle logout
function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        // Clear stored auth data
        localStorage.removeItem('discord_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('roles');
        
        // Update UI
        updateLoginState();
        updateRestrictedNav();
        
        // Reload page
        window.location.reload();
    }
}

// Update restricted nav visibility
function updateRestrictedNav() {
    const token = localStorage.getItem('discord_token');
    const userRoles = JSON.parse(localStorage.getItem('roles') || '[]');
    const requiredRoles = window.config.discord.requiredRoles || [];
    
    const hasAPDRole = userRoles.some(role => requiredRoles.includes(role));
    
    const restrictedNavItems = document.querySelectorAll('.restricted-nav');
    const restrictedCreateItems = document.querySelectorAll('.restricted-create');
    
    // Show/hide restricted nav items based on roles
    restrictedNavItems.forEach(item => {
        item.style.display = (token && hasAPDRole) ? 'block' : 'none';
    });
    
    // Show/hide create update based on HR role
    const hasHRRole = userRoles.includes('905142677034016778'); // HR role ID
    restrictedCreateItems.forEach(item => {
        item.style.display = (token && hasHRRole) ? 'block' : 'none';
    });
}

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