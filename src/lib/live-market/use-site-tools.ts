'use client';

import { useEffect, useState } from 'react';

import { createSiteTools, type SiteToolRuntime } from './site-tools';

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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useSiteTools(runtime: SiteToolRuntime, availabilityKey: string): SiteToolStatus {
  const [status, setStatus] = useState<SiteToolStatus>(checkingStatus);

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
      scheduleStatus({
        phase: 'unsupported',
        registeredNames: [],
        message: 'Ordinary browser mode. The human controls remain fully usable.',
      });
      return () => {
        active = false;
      };
    }

    const controller = new AbortController();
    const tools = createSiteTools(runtime);

    scheduleStatus({
      phase: 'registering',
      registeredNames: [],
      message: `Publishing ${tools.length} page-owned tools for the current live state.`,
    });

    void Promise.all(
      tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal })),
    )
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
        controller.abort();
        if (!active) {
          return;
        }
        setStatus({
          phase: 'error',
          registeredNames: [],
          message: `Site Tool registration failed: ${errorMessage(error)}`,
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [availabilityKey, runtime]);

  return status;
}
