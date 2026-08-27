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
  readonly settled: Promise<void>;
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
        registration.controller.abort();
        registrations.delete(name);
      }
    }

    for (const [name, tool] of desiredTools) {
      if (registrations.has(name)) {
        continue;
      }
      const controller = new AbortController();
      const settled = Promise.resolve(
        modelContext.registerTool(tool, { signal: controller.signal }),
      );
      registrations.set(name, {
        controller,
        settled,
      });
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
