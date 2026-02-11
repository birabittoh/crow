# Credential Acquisition Guide

This document provides instructions on how to obtain the necessary credentials for each supported social media platform.

## 1. Telegram
Telegram is the easiest platform to set up.

1.  **Bot Token:**
    *   Open Telegram and search for `@BotFather`.
    *   Send `/newbot` and follow the instructions to create a bot.
    *   Copy the **API Token** provided.
2.  **Chat ID:**
    *   Add your bot to the channel or group where you want to publish.
    *   Make the bot an **Administrator** with permission to post messages.
    *   To get the Chat ID, you can use a bot like `@userinfobot` or send a message to the channel and check `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`.
    *   Channel IDs usually start with `-100`.

## 2. Mastodon
1.  **Instance URL:** This is the base URL of your Mastodon instance (e.g., `https://mastodon.social`).
2.  **Access Token:**
    *   Log in to your Mastodon instance.
    *   Go to **Preferences** > **Development** > **New Application**.
    *   Give it a name (e.g., "Crow").
    *   Select the `write:statuses` and `write:media` scopes.
    *   Click **Submit** and then click on the application name to see your **Access Token**.

## 3. Bluesky
1.  **Identifier:** Your Bluesky handle (e.g., `user.bsky.social`) or email.
2.  **App Password:**
    *   Log in to Bluesky.
    *   Go to **Settings** > **App Passwords**.
    *   Click **Add App Password**.
    *   Give it a name (e.g., "Crow") and copy the generated password. **Do not use your main account password.**

## 4. Twitter (X)
1.  **Developer Account:** Sign up at [developer.x.com](https://developer.x.com).
2.  **Create App:**
    *   Create a new project and app.
    *   Enable **User authentication settings**:
        *   App permissions: **Read and write**.
        *   Type of App: **Web App, Automated App or Bot**.
        *   Callback URI / Redirect URL: `http://localhost:3000` (required but not used for this app's logic).
        *   Website URL: `http://localhost:3000`.
3.  **API Key & Secret:** Found under **Keys and Tokens**.
4.  **Access Token & Secret:** Generate these under the **User Access Tokens** section. Ensure they have "Read and Write" permissions.

## 5. Facebook & Instagram
Both use the Meta Graph API.

1.  **Developer Account:** Register at [developers.facebook.com](https://developers.facebook.com).
2.  **Create App:**
    *   Create a "Business" or "Other" type app.
    *   Add the **Facebook Login** and **Instagram Graph API** products.
3.  **Page ID:** Found in your Facebook Page's "About" or "Edit Page Info" section.
4.  **Instagram Business Account ID:**
    *   Your Instagram account must be a **Professional/Business** account.
    *   It must be linked to a Facebook Page.
    *   Go to Page Settings > Linked Accounts > Instagram to find the ID.
5.  **Page Access Token:**
    *   Use the **Graph API Explorer**.
    *   Select your App.
    *   Under "User or Page", select your Page.
    *   Request scopes: `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`.
    *   Generate the token. **Note:** This is a short-lived token. You should exchange it for a **Long-Lived Page Access Token** in the Access Token Tool.
