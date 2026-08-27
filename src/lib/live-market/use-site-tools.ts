'use client';

import { useEffect, useRef, useState } from 'react';

import { createSiteTools, type SiteToolRuntime } from './site-tools';

export type SiteToolFactory = (runtime: SiteToolRuntime) => readonly WebMCP.ModelContextTool[];

export const siteToolPhases = ['checking', 'unsupported', 'registering', 'ready', 'error'] as const;
export type SiteToolPhase = (typeof siteToolPhases)[number];

export interface SiteToolStatus {
  readonly phase: SiteToolPhase;
  readonly registeredNames: readonly string[];
  readonly message: string;
}

const checkingStatus: SiteToolStatus = {
  phase: 'checking',
  registeredNames: [],
  message: 'Checking this browser for native Site Tools.',
};

interface SiteToolRegistration {
  readonly controller: AbortController;
  readonly settled: Promise<void>;
}

function unregisterAll(registrations: Map<string, SiteToolRegistration>): void {
  for (const { controller } of registrations.values()) {
    controller.abort();
  }
  registrations.clear();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useSiteTools(
  runtime: SiteToolRuntime,
  availabilityKey: string,
  createTools: SiteToolFactory = createSiteTools,
): SiteToolStatus {
  const [status, setStatus] = useState<SiteToolStatus>(checkingStatus);
  const registrationsRef = useRef<Map<string, SiteToolRegistration>>(new Map());

  useEffect(() => {
    const registrations = registrationsRef.current;
    return () => {
      unregisterAll(registrations);
    };
  }, [runtime]);

  useEffect(() => {
    let active = true;
    const scheduleStatus = (nextStatus: SiteToolStatus): void => {
      queueMicrotask(() => {
        if (active) {
          setStatus(nextStatus);
        }
      });
    };

    const modelContext = document.modelContext;
    if (modelContext === undefined) {
      unregisterAll(registrationsRef.current);
      scheduleStatus({
        phase: 'unsupported',
        registeredNames: [],
        message: 'Ordinary browser mode. The human controls remain fully usable.',
      });
      return () => {
        active = false;
      };
    }

    const tools = createTools(runtime);
    const desiredTools = new Map(tools.map((tool) => [tool.name, tool]));
    const registrations = registrationsRef.current;

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
      const settled = modelContext.registerTool(tool, { signal: controller.signal });
      registrations.set(name, { controller, settled });
    }

    scheduleStatus({
      phase: 'registering',
      registeredNames: [],
      message: `Reconciling ${tools.length} page-owned tools for the current live state.`,
    });

    const pending = tools.map(({ name }) => {
      const registration = registrations.get(name);
      if (registration === undefined) {
        return Promise.reject(new Error(`Missing Site Tool registration for ${name}.`));
      }
      return registration.settled;
    });

    void Promise.all(pending)
      .then(() => {
        if (!active) {
          return;
        }
        setStatus({
          phase: 'ready',
          registeredNames: tools.map(({ name }) => name),
          message: `${tools.length} native Site Tools are available for this page state.`,
        });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        unregisterAll(registrations);
        setStatus({
          phase: 'error',
          registeredNames: [],
          message: `Site Tool registration failed: ${errorMessage(error)}`,
        });
      });

    return () => {
      active = false;
    };
  }, [availabilityKey, createTools, runtime]);

  return status;
}
