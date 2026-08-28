'use client';

import { useEffect, useRef, useState } from 'react';

export const dynamicSiteToolPhases = [
  'checking',
  'unsupported',
  'registering',
  'ready',
  'error',
] as const;
export type DynamicSiteToolPhase = (typeof dynamicSiteToolPhases)[number];

export interface DynamicSiteToolStatus {
  readonly phase: DynamicSiteToolPhase;
  readonly registeredNames: readonly string[];
  readonly message: string;
}

export type DynamicSiteToolFactory = () => readonly WebMCP.ModelContextTool[];

interface SiteToolRegistration {
  readonly controller: AbortController;
  settled: Promise<void>;
  activeExecutions: number;
  abortRequested: boolean;
}

const checkingStatus: DynamicSiteToolStatus = {
  phase: 'checking',
  registeredNames: [],
  message: 'Checking this browser for native Site Tools.',
};

function unregisterAll(registrations: Map<string, SiteToolRegistration>): void {
  for (const { controller } of registrations.values()) {
    controller.abort();
  }
  registrations.clear();
}

function requestUnregister(
  name: string,
  registration: SiteToolRegistration,
  registrations: Map<string, SiteToolRegistration>,
): void {
  if (registration.activeExecutions > 0) {
    registration.abortRequested = true;
    return;
  }
  registration.controller.abort();
  if (registrations.get(name) === registration) {
    registrations.delete(name);
  }
}

function invocationAwareTool(
  tool: WebMCP.ModelContextTool,
  registration: SiteToolRegistration,
  registrations: Map<string, SiteToolRegistration>,
): WebMCP.ModelContextTool {
  return {
    ...tool,
    execute: async (input, options): Promise<unknown> => {
      if (registration.abortRequested) {
        throw new DOMException('This Site Tool is no longer available.', 'AbortError');
      }
      registration.activeExecutions += 1;
      try {
        return await tool.execute(input, options);
      } finally {
        registration.activeExecutions -= 1;
        if (registration.abortRequested && registration.activeExecutions === 0) {
          requestUnregister(tool.name, registration, registrations);
        }
      }
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useDynamicSiteTools(
  createTools: DynamicSiteToolFactory,
  availabilityKey: string,
): DynamicSiteToolStatus {
  const [status, setStatus] = useState<DynamicSiteToolStatus>(checkingStatus);
  const registrationsRef = useRef<Map<string, SiteToolRegistration>>(new Map());

  useEffect(() => {
    const registrations = registrationsRef.current;
    return () => {
      unregisterAll(registrations);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const modelContext = document.modelContext;
    const registrations = registrationsRef.current;

    if (modelContext === undefined) {
      unregisterAll(registrations);
      queueMicrotask(() => {
        if (active) {
          setStatus({
            phase: 'unsupported',
            registeredNames: [],
            message: 'Ordinary browser mode. Every human control remains usable.',
          });
        }
      });
      return () => {
        active = false;
      };
    }

    const tools = createTools();
    const desiredTools = new Map(tools.map((tool) => [tool.name, tool]));

    for (const [name, registration] of registrations) {
      if (!desiredTools.has(name)) {
        requestUnregister(name, registration, registrations);
      }
    }

    for (const [name, tool] of desiredTools) {
      const existing = registrations.get(name);
      if (existing !== undefined) {
        existing.abortRequested = false;
        continue;
      }
      const controller = new AbortController();
      const registration: SiteToolRegistration = {
        controller,
        settled: Promise.resolve(),
        activeExecutions: 0,
        abortRequested: false,
      };
      const registeredTool = invocationAwareTool(tool, registration, registrations);
      const settled = Promise.resolve(
        modelContext.registerTool(registeredTool, { signal: controller.signal }),
      );
      registration.settled = settled;
      registrations.set(name, registration);
    }

    queueMicrotask(() => {
      if (active) {
        setStatus({
          phase: 'registering',
          registeredNames: [],
          message: `Reconciling ${tools.length} page-owned tools for the current evidence state.`,
        });
      }
    });

    const pending = tools.map(({ name }) => {
      const registration = registrations.get(name);
      return (
        registration?.settled ?? Promise.reject(new Error(`Missing registration for ${name}.`))
      );
    });

    void Promise.all(pending)
      .then(() => {
        if (active) {
          setStatus({
            phase: 'ready',
            registeredNames: tools.map(({ name }) => name),
            message: `${tools.length} native Site Tools match the current evidence state.`,
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          unregisterAll(registrations);
          setStatus({
            phase: 'error',
            registeredNames: [],
            message: `Site Tool registration failed: ${errorMessage(error)}`,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [availabilityKey, createTools]);

  return status;
}
