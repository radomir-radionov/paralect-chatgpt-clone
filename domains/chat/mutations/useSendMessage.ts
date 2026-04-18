"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sendMessage } from "@domains/chat/actions/messages";
import {
  appendOptimisticMessage,
  applyMessageStatus,
  replaceMessage,
} from "@domains/chat/queries/messagesCache";
import type { Message } from "@domains/chat/types/chat.types";

type SendMessageInput = {
  id: string;
  text: string;
  roomId: string;
  author: {
    id: string;
    name: string;
    image_url: string | null;
  };
};

type SendMessageResult =
  | { error: false; message: Message }
  | { error: true; message: string };

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation<SendMessageResult, Error, SendMessageInput>({
    mutationFn: async ({ id, text, roomId }) =>
      sendMessage({ id, text, roomId }),
    onMutate: async ({ id, text, roomId, author }) => {
      appendOptimisticMessage(queryClient, roomId, {
        id,
        text,
        created_at: new Date().toISOString(),
        author_id: author.id,
        author: { name: author.name, image_url: author.image_url },
        status: "pending",
      });
    },
    onSuccess: (result, variables) => {
      if (result.error) {
        applyMessageStatus(queryClient, variables.roomId, variables.id, "error");
        return;
      }

      replaceMessage(queryClient, variables.roomId, {
        ...result.message,
        status: "success",
      });
    },
    onError: (_err, variables) => {
      applyMessageStatus(queryClient, variables.roomId, variables.id, "error");
    },
  });
}
