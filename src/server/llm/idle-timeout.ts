type StreamIdleTimeoutOptions = {
  timeoutMs: number;
  timeoutMessage: string;
};

export async function* withStreamIdleTimeout(
  stream: AsyncIterable<string>,
  options: StreamIdleTimeoutOptions,
): AsyncGenerator<string> {
  const iterator = stream[Symbol.asyncIterator]();
  let finished = false;

  try {
    while (true) {
      const result = await nextWithTimeout(iterator, options);
      if (result.done) {
        finished = true;
        return;
      }

      yield result.value;
    }
  } finally {
    if (!finished) {
      await iterator.return?.();
    }
  }
}

function nextWithTimeout(
  iterator: AsyncIterator<string>,
  options: StreamIdleTimeoutOptions,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<IteratorResult<string>>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(options.timeoutMessage));
    }, options.timeoutMs);
  });

  return Promise.race([iterator.next(), timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}
