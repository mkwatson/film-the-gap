import { createGateway, generateText, Output } from 'ai';

import {
  findingFitsVideo,
  videoEvidenceFallbackModels,
  videoEvidenceFindingSchema,
  videoEvidencePrimaryModel,
  type AuthorizedVideoAnalysisInput,
  type VideoEvidenceProposal,
} from '../video-analysis';

export interface GenerateAuthorizedVideoOptions {
  readonly apiKey: string;
  readonly abortSignal?: AbortSignal;
}

function analysisInstructions(): string {
  return [
    'Review one rights-cleared product video against one exact shopper question.',
    'Report only what is visibly or audibly present in the recording.',
    'Never infer product identity, authenticity, ownership, intent, safety, durability, historical events, or conditions outside the cited interval.',
    'Choose inconclusive whenever the requested condition, control, product, or outcome is not continuously observable enough to answer.',
    'Cuts, missing setup, off-camera action, or an unclear outcome must be disclosed in continuity and limitations.',
    'Cite the smallest interval that contains the setup and observable outcome, using integer seconds.',
    'A human contributor will review and may correct this proposal before anything is published.',
  ].join(' ');
}

function analysisPrompt(input: AuthorizedVideoAnalysisInput): string {
  return [
    `Product label: ${input.productName}`,
    `Shopper question: ${input.question}`,
    `Filming instruction: ${input.instruction}`,
    `Success criterion: ${input.successCriterion}`,
    `Recorded duration: ${input.durationSeconds} seconds.`,
    input.continuousTakeRequired
      ? 'This claim requires one continuous take; a conclusive result is invalid if continuity is edited or unclear.'
      : 'Disclose any visible edit or continuity uncertainty.',
    'Return a bounded proposal with the exact evidence interval, visible details, and limitations.',
  ].join('\n');
}

export async function generateAuthorizedVideoProposal(
  input: AuthorizedVideoAnalysisInput,
  options: GenerateAuthorizedVideoOptions,
): Promise<VideoEvidenceProposal> {
  const gateway = createGateway({ apiKey: options.apiKey });
  const result = await generateText({
    model: gateway(videoEvidencePrimaryModel),
    output: Output.object({
      name: 'ClaimScopedProductVideoEvidence',
      description:
        'A timestamped observation grounded only in one rights-cleared product recording.',
      schema: videoEvidenceFindingSchema,
    }),
    instructions: analysisInstructions(),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: new URL(input.videoUrl),
            mediaType: 'video/mp4',
            filename: `${input.uploadId}.mp4`,
          },
          { type: 'text', text: analysisPrompt(input) },
        ],
      },
    ],
    reasoning: 'low',
    maxOutputTokens: 900,
    providerOptions: {
      gateway: {
        models: [...videoEvidenceFallbackModels],
        disallowPromptTraining: true,
        tags: ['webmcp-challenge', 'product-evidence', 'video-review-v1'],
      },
    },
    include: {
      requestBody: false,
      requestMessages: false,
      responseBody: false,
    },
    timeout: { totalMs: 45_000 },
    ...(options.abortSignal === undefined ? {} : { abortSignal: options.abortSignal }),
  });

  if (!findingFitsVideo(result.output, input.durationSeconds, input.continuousTakeRequired)) {
    throw new Error('The model proposal did not fit the recording boundary.');
  }

  return {
    modelId: result.finalStep.response.modelId,
    finding: result.output,
  };
}
