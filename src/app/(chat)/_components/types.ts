export type MessageRole = "user" | "assistant";

export type Message = {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly createdAt: number;
};

export type Conversation = {
  readonly id: string;
  readonly title: string;
  readonly messages: readonly Message[];
  readonly createdAt: number;
};

export type AuthenticatedUser = {
  readonly id: string;
  readonly email: string;
};
