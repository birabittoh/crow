import { Client, GatewayIntentBits, TextChannel, AttachmentBuilder } from 'discord.js';
import {
  PlatformService,
  PublishContent,
  PublishResult,
  PlatformValidationError,
  PlatformError,
  OptionField,
  CharacterLimits,
  CredentialField,
} from '../platform-service';
import { MediaAsset } from '../../schemas/media';
import {
  DISCORD_MAX_MESSAGE_LENGTH,
} from './discord-schemas';
import fs from 'fs';

interface DiscordCredentials {
  botToken: string;
  guildId: string;
  channelId: string;
}

export class DiscordService implements PlatformService {
  readonly platformName = 'discord';
  private credentials: DiscordCredentials | null;

  constructor(credentials: DiscordCredentials | null) {
    this.credentials = credentials;
  }

  getCredentialFields(): CredentialField[] {
    return [
      {
        key: 'botToken',
        label: 'Bot Token',
        type: 'password',
        placeholder: 'Get from discord.com/developers/applications',
      },
      {
        key: 'guildId',
        label: 'Server ID (Guild ID)',
        type: 'text',
        placeholder: 'Right-click server → Copy Server ID (enable Developer Mode)',
      },
      {
        key: 'channelId',
        label: 'Channel ID',
        type: 'text',
        placeholder: 'Right-click channel → Copy Channel ID',
      },
    ];
  }

  isAvailable(): boolean {
    return this.credentials !== null &&
           !!this.credentials.botToken &&
           !!this.credentials.guildId &&
           !!this.credentials.channelId;
  }

  getOptionFields(): OptionField[] {
    return [
      {
        key: 'thread_id',
        label: 'Thread ID',
        type: 'string',
        description: 'Post to a specific thread (right-click thread → Copy Thread ID)',
        required: false,
      },
      {
        key: 'suppress_embeds',
        label: 'Suppress embeds',
        type: 'boolean',
        description: 'Disable automatic URL previews/embeds',
      },
    ];
  }

  getCharacterLimits(): CharacterLimits {
    return {
      maxChars: DISCORD_MAX_MESSAGE_LENGTH,
      maxCharsWithMedia: DISCORD_MAX_MESSAGE_LENGTH,
    };
  }

  validatePost(content: PublishContent): PlatformValidationError[] {
    const errors: PlatformValidationError[] = [];

    if (content.text.trim().length === 0 && content.media.length === 0) {
      errors.push({
        field: 'content',
        message: 'Discord requires either text or media',
      });
    }

    if (content.text.length > DISCORD_MAX_MESSAGE_LENGTH) {
      errors.push({
        field: 'text',
        message: `Text exceeds Discord message limit of ${DISCORD_MAX_MESSAGE_LENGTH} characters`,
      });
    }

    return errors;
  }

  async uploadMedia(_asset: MediaAsset): Promise<string> {
    // Discord doesn't require pre-uploading; media is sent inline with the message.
    return _asset.storage_path;
  }

  async publishPost(content: PublishContent, uploadedMediaIds: string[]): Promise<PublishResult> {
    if (!this.credentials) {
      throw new Error('Discord credentials not configured');
    }

    // Create a temporary client for this operation
    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    try {
      await client.login(this.credentials.botToken);

      // Wait for client to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Discord client login timeout'));
        }, 10000);

        client.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      // Get the target channel (or thread)
      const threadId = content.options.thread_id as string | undefined;
      const targetChannelId = threadId || this.credentials.channelId;

      const channel = await client.channels.fetch(targetChannelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(threadId ? 'Thread not found or is not a text-based thread' : 'Channel not found or is not a text channel');
      }

      const textChannel = channel as TextChannel;

      // Prepare message options
      const messageOptions: any = {};

      if (content.text) {
        messageOptions.content = content.text;
      }

      // Attach media files if present
      if (uploadedMediaIds.length > 0 && content.media.length > 0) {
        const attachments = content.media.map((asset, i) => {
          const mediaPath = uploadedMediaIds[i];
          return new AttachmentBuilder(mediaPath, { name: asset.original_filename || 'file' });
        });
        messageOptions.files = attachments;
      }

      // Handle platform-specific options
      if (content.options.suppress_embeds) {
        messageOptions.flags = [4]; // SUPPRESS_EMBEDS flag
      }

      // Send the message
      const message = await textChannel.send(messageOptions);

      return { remotePostId: message.id };
    } finally {
      // Always cleanup the client
      client.destroy();
    }
  }

  async verifyCredentials(): Promise<void> {
    if (!this.credentials) {
      throw new Error('Discord credentials not configured');
    }

    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    try {
      await client.login(this.credentials.botToken);

      // Wait for client to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Discord client login timeout'));
        }, 10000);

        client.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      // Verify guild access
      const guild = await client.guilds.fetch(this.credentials.guildId).catch(() => null);
      if (!guild) {
        throw new Error('Bot cannot access the specified server. Make sure the bot is added to the server.');
      }

      // Verify channel access
      const channel = await client.channels.fetch(this.credentials.channelId).catch(() => null);
      if (!channel) {
        throw new Error('Channel not found or bot does not have access');
      }

      if (!channel.isTextBased()) {
        throw new Error('Specified channel is not a text channel');
      }

      // Check if bot has permission to send messages
      const textChannel = channel as TextChannel;
      const permissions = textChannel.permissionsFor(client.user!);
      if (!permissions?.has('SendMessages')) {
        throw new Error('Bot does not have permission to send messages in this channel');
      }
    } catch (error: any) {
      if (error.message.includes('Incorrect login')) {
        throw new Error('Invalid bot token');
      }
      throw error;
    } finally {
      client.destroy();
    }
  }

  mapError(error: unknown): PlatformError {
    if (error instanceof Error) {
      const message = error.message;
      const retryable =
        message.includes('429') ||
        message.includes('rate limit') ||
        message.includes('timeout') ||
        message.includes('ECONNRESET') ||
        message.includes('502') ||
        message.includes('503');

      return {
        code: 'DISCORD_ERROR',
        message: message.substring(0, 500),
        retryable,
      };
    }

    return {
      code: 'DISCORD_UNKNOWN_ERROR',
      message: String(error).substring(0, 500),
      retryable: false,
    };
  }

  supportsFeature(feature: string): boolean {
    const supported = ['text', 'images', 'video', 'files'];
    return supported.includes(feature);
  }
}
