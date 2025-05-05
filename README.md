# APD Portal

A modern web portal for the APD Police Department with Discord authentication and role-based access control.

## Features

- Modern, responsive design
- Discord authentication
- Role-based access control
- Protected routes for police department members
- Dynamic navigation based on user roles

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory with the following variables:
```
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_GUILD_ID=your_discord_server_id
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret # Generate with: openssl rand -base64 32
```

3. Set up Discord Application:
   - Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to the OAuth2 section
   - Add redirect URI: `http://localhost:3000/api/auth/callback/discord`
   - Copy the Client ID and Client Secret to your `.env.local` file
   - Get your Discord server (guild) ID and add it to `DISCORD_GUILD_ID`

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Role-Based Access

The portal checks for specific Discord roles to grant access to protected routes. Make sure to set up the appropriate roles in your Discord server and assign them to users who should have access to protected content. 