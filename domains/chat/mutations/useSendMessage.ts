"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sendMessage } from "@domains/chat/actions/messages";
import { chatKeys } from "@domains/chat/queries/keys";
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
  | { error: false; userMessage: Message; assistantMessage: Message }
  | { error: true; message: string; userMessage?: Message };

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
        role: "user",
        author: { name: author.name, image_url: author.image_url },
        status: "pending",
      });
    },
    onSuccess: (result, variables) => {
      if (result.error) {
        if (result.userMessage) {
          replaceMessage(queryClient, variables.roomId, {
            ...result.userMessage,
            status: "success",
          });
          queryClient.invalidateQueries({
            queryKey: chatKeys.joinedRooms(variables.author.id),
          });
        } else {
          applyMessageStatus(queryClient, variables.roomId, variables.id, "error");
        }
        return;
      }

      replaceMessage(queryClient, variables.roomId, {
        ...result.userMessage,
        status: "success",
      });
      replaceMessage(queryClient, variables.roomId, {
        ...result.assistantMessage,
        status: "success",
      });

      queryClient.invalidateQueries({
        queryKey: chatKeys.joinedRooms(variables.author.id),
      });
    },
    onError: (_err, variables) => {
      applyMessageStatus(queryClient, variables.roomId, variables.id, "error");
    },
  });
}
