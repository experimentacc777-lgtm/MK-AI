
export type Role = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  image?: string;
  generatedImage?: string;
}

export interface VoiceState {
  isListening: boolean;
  transcript: string;
}
