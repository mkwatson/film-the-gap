import { createGateway, generateText, Output } from 'ai';

import {
  findingFitsVideo,
  generatedVideoEvidenceFindingSchema,
  videoEvidenceFallbackModels,
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
    'Separately check whether the exact mission phrase is visibly shown or audibly spoken; do not infer it from similar words.',
    'The phrase only bounds the recording to after the mission was issued. It does not prove identity, ownership, product authenticity, or the truth of the product claim.',
    'Cite the smallest interval that contains the setup and observable outcome, using integer seconds.',
    'Map the entire recording into no more than 12 chronological integer-second segments with no gaps or overlaps.',
    'Start the first segment at 0, end the final segment at the supplied duration, and mark each boundary as continuous, a visible cut, or unclear.',
    'Use claim_evidence only where the shopper question is visibly or audibly tested; setup and context do not become proof merely because they appear nearby.',
    'Default video sampling is coarse, so mark a transition unclear whenever a cut cannot be located confidently.',
    'A human contributor will review and may correct this proposal before anything is published.',
  ].join(' ');
}

function analysisPrompt(input: AuthorizedVideoAnalysisInput): string {
  return [
    `Product label: ${input.productName}`,
    `Shopper question: ${input.question}`,
    `Filming instruction: ${input.instruction}`,
    `Success criterion: ${input.successCriterion}`,
    `Exact fresh-capture mission phrase: ${input.captureChallengePhrase}`,
    `Recorded duration: ${input.durationSeconds} seconds.`,
    input.continuousTakeRequired
      ? 'This claim requires one continuous take; a conclusive result is invalid if continuity is edited or unclear.'
      : 'Disclose any visible edit or continuity uncertainty.',
    'Return a bounded proposal with the exact evidence interval, a complete navigation map, visible details, and limitations.',
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
      schema: generatedVideoEvidenceFindingSchema,
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
    maxOutputTokens: 1_600,
    providerOptions: {
      gateway: {
        models: [...videoEvidenceFallbackModels],
        disallowPromptTraining: true,
        tags: ['webmcp-challenge', 'product-evidence', 'video-review-v2'],
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

  const finding = generatedVideoEvidenceFindingSchema.safeParse(result.output);
  if (
    !finding.success ||
    !findingFitsVideo(finding.data, input.durationSeconds, input.continuousTakeRequired)
  ) {
    throw new Error('The model proposal did not fit the recording boundary.');
  }

  return {
    modelId: result.finalStep.response.modelId,
    finding: finding.data,
  };
}
