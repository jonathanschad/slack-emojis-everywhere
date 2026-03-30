export interface EmojiMap {
  [name: string]: string;
}

export interface Settings {
  refreshInterval: number;
  enabled: boolean;
  emojiSize: number;
}

export interface ExtensionStatus {
  authenticated: boolean;
  teamName: string | null;
  emojiCount: number;
  lastRefresh: number | null;
  error: string | null;
}

export type MessageType =
  | { type: "START_OAUTH" }
  | { type: "FETCH_EMOJIS" }
  | { type: "GET_STATUS" }
  | { type: "DISCONNECT" }
  | { type: "STATUS_RESPONSE"; status: ExtensionStatus }
  | { type: "OAUTH_COMPLETE"; success: boolean; error?: string }
  | { type: "EMOJIS_UPDATED" };

export const DEFAULT_SETTINGS: Settings = {
  refreshInterval: 30,
  enabled: true,
  emojiSize: 20,
};
