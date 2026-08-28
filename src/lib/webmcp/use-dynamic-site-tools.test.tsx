import { act, render, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useDynamicSiteTools } from './use-dynamic-site-tools';

interface Registration {
  readonly tool: WebMCP.ModelContextTool;
  readonly signal: AbortSignal | undefined;
}

class RecordingModelContext extends EventTarget implements WebMCP.ModelContext {
  readonly registrations: Registration[] = [];
  ontoolchange: ((this: WebMCP.ModelContext, event: Event) => unknown) | null = null;

  async registerTool(
    tool: WebMCP.ModelContextTool,
    options?: WebMCP.ModelContextRegisterToolOptions,
  ): Promise<void> {
    this.registrations.push({ tool, signal: options?.signal });
  }

  async getTools(): Promise<WebMCP.RegisteredTool[]> {
    return [];
  }
}

interface Deferred {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
}

function deferred(): Deferred {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  if (resolvePromise === undefined) {
    throw new Error('Deferred promise was not initialized.');
  }
  return { promise, resolve: resolvePromise };
}

function Harness({ completion }: { readonly completion: Promise<void> }): React.JSX.Element {
  const [available, setAvailable] = useState(true);
  const createTools = useCallback(
    (): readonly WebMCP.ModelContextTool[] =>
      available
        ? [
            {
              name: 'mutate_once',
              description: 'Mutate state once.',
              execute: async () => {
                setAvailable(false);
                await completion;
                return { ok: true };
              },
            },
          ]
        : [],
    [available, completion],
  );
  useDynamicSiteTools(createTools, available ? 'available' : 'retired');
  return <div>{available ? 'available' : 'retired'}</div>;
}

function setModelContext(modelContext: WebMCP.ModelContext | undefined): void {
  Object.defineProperty(document, 'modelContext', {
    configurable: true,
    value: modelContext,
  });
}

afterEach(() => {
  setModelContext(undefined);
});

describe('dynamic Site Tool invocation lifecycle', () => {
  it('keeps a mutating registration alive until the invocation that retired it returns', async () => {
    const modelContext = new RecordingModelContext();
    const completion = deferred();
    setModelContext(modelContext);
    render(<Harness completion={completion.promise} />);
    await waitFor(() => expect(modelContext.registrations).toHaveLength(1));
    const registration = modelContext.registrations[0];
    if (registration === undefined) {
      throw new Error('Expected a registered Site Tool.');
    }

    let invocation!: Promise<unknown>;
    act(() => {
      invocation = Promise.resolve(
        registration.tool.execute({}, { signal: new AbortController().signal }),
      );
    });
    await waitFor(() => expect(document.body.textContent).toContain('retired'));
    expect(registration.signal?.aborted).toBe(false);

    await act(async () => {
      completion.resolve();
      await invocation;
    });
    await waitFor(() => expect(registration.signal?.aborted).toBe(true));
  });

  it('still aborts every registration immediately when the owning page unmounts', async () => {
    const modelContext = new RecordingModelContext();
    const completion = deferred();
    setModelContext(modelContext);
    const rendered = render(<Harness completion={completion.promise} />);
    await waitFor(() => expect(modelContext.registrations).toHaveLength(1));
    const registration = modelContext.registrations[0];
    if (registration === undefined) {
      throw new Error('Expected a registered Site Tool.');
    }
    void registration.tool.execute({}, { signal: new AbortController().signal });

    rendered.unmount();
    expect(registration.signal?.aborted).toBe(true);
    completion.resolve();
  });
});
