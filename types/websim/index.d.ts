/**
 * WebSim API Type Definitions
 *
 * Type declarations for the global websim API used by neon apps.
 */

declare global {
  interface WebsimUser {
    username: string;
    id: string;
    avatar_url: string | null;
  }

  interface WebsimChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }

  interface WebsimChatOptions {
    messages: WebsimChatMessage[];
    json?: boolean;
    response_format?: { type: 'json_object' };
    temperature?: number;
    max_tokens?: number;
  }

  interface WebsimChatResponse {
    content: string;
    role: 'assistant';
  }

  interface WebsimImageOptions {
    prompt: string;
    aspect_ratio?: '1:1' | '16:9' | '9:16' | 'square' | 'landscape' | 'portrait';
    size?: string;
    model?: string;
    quality?: string;
  }

  interface WebsimImageResponse {
    url: string;
  }

  interface WebsimCollectionRecord {
    id: string;
    created_at: string;
    updated_at?: string;
    [key: string]: unknown;
  }

  interface WebsimCollectionOptions {
    orderBy?: string;
    order?: 'asc' | 'desc';
    limit?: number;
  }

  interface WebsimCollection<T extends WebsimCollectionRecord = WebsimCollectionRecord> {
    create(data: Omit<T, 'id' | 'created_at'>): Promise<T>;
    update(id: string, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T>;
    delete(id: string): Promise<void>;
    get(id: string): Promise<T | null>;
    getAll(options?: WebsimCollectionOptions): Promise<T[]>;
    subscribe(callback: (items: T[]) => void): () => void;
    filter(predicate: (item: T) => boolean): Promise<T[]>;
  }

  interface WebsimSocketInstance {
    collection<T extends WebsimCollectionRecord = WebsimCollectionRecord>(name: string): WebsimCollection<T>;
    send(data: unknown): void;
    onmessage: ((event: { data: unknown }) => void) | null;
    close(): void;
  }

  interface WebsimSocketConstructor {
    new(options?: { roomId?: string }): WebsimSocketInstance;
    prototype: WebsimSocketInstance;
  }

  const WebsimSocket: WebsimSocketConstructor;

  interface WebsimConfig {
    configured: boolean;
    chatModel: string | null;
    imageModel: string | null;
  }

  interface Websim {
    config(options: {
      apiKey?: string | null;
      chatModel?: string;
      imageModel?: string
    }): WebsimConfig;

    getConfig(): {
      openai: WebsimConfig;
    };

    getCurrentUser(): Promise<WebsimUser>;

    chat: {
      completions: {
        create(options: WebsimChatOptions): Promise<WebsimChatResponse>;
      };
    };

    imageGen(options: WebsimImageOptions): Promise<WebsimImageResponse>;
  }

  const websim: Websim;

  interface Window {
    websim: Websim;
    WebsimSocket: WebsimSocketConstructor;
  }
}

export {};
