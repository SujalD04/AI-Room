import { v4 as uuidv4 } from 'uuid';
import { getCompletion, streamCompletion, LLMMessage } from './gateway';
import type {
    CouncilConfig,
    CouncilDetails,
    CouncilIndividualResponse,
    ModelConfig,
} from '@airoom/shared';

/**
 * AI Council (Mixture-of-Agents) Engine
 *
 * Implements a multi-LLM peer review system:
 * 1. User query is sent to N selected LLMs in parallel
 * 2. All responses are fed to an aggregator LLM
 * 3. Aggregator synthesizes a consensus answer
 * 4. If consensus is low, another debate round occurs (max configurable rounds)
 */

export interface CouncilCallbacks {
    onIndividualResponse: (response: CouncilIndividualResponse) => void;
    onAggregationStart: () => void;
    onAggregationToken: (token: string) => void;
    onComplete: (details: CouncilDetails, finalContent: string) => void;
    onError: (error: string) => void;
}

/**
 * Run the AI Council on a user query.
 */
export async function runCouncil(
    userId: string,
    messages: LLMMessage[],
    config: CouncilConfig,
    callbacks: CouncilCallbacks
): Promise<void> {
    const { models, aggregatorModel, maxDebateRounds, consensusThreshold } = config;
    let currentRound = 0;
    let previousResponses: CouncilIndividualResponse[] = [];

    try {
        while (currentRound < maxDebateRounds) {
            currentRound++;

            // ── Layer 1: Parallel queries to all council members ──
            const roundMessages = currentRound === 1
                ? messages
                : buildDebateMessages(messages, previousResponses, currentRound);

            const individualResponses = await queryCouncilMembers(
                userId,
                roundMessages,
                models,
                callbacks
            );

            previousResponses = individualResponses;

            // ── Layer 2: Aggregation ──
            callbacks.onAggregationStart();

            const aggregationPrompt = buildAggregationPrompt(
                messages[messages.length - 1]?.content || '',
                individualResponses,
                currentRound
            );

            let aggregatedContent = '';

            await streamCompletion(
                {
                    model: aggregatorModel.modelId,
                    provider: aggregatorModel.provider,
                    messages: [
                        {
                            role: 'system',
                            content: `You are the AI Council Aggregator. Your role is to synthesize responses from multiple AI models into a single, comprehensive, and accurate answer. Identify areas of agreement and disagreement. When models disagree, analyze which reasoning is stronger. Always produce a clear final answer. End your response with a confidence score from 0 to 100 in the format: [CONFIDENCE: XX]`,
                        },
                        { role: 'user', content: aggregationPrompt },
                    ],
                    temperature: 0.3,
                    maxTokens: aggregatorModel.maxTokens || 4096,
                    userId,
                },
                {
                    onToken: (token) => {
                        aggregatedContent += token;
                        callbacks.onAggregationToken(token);
                    },
                    onDone: () => { },
                    onError: (err) => callbacks.onError(`Aggregation failed: ${err}`),
                }
            );

            // ── Extract consensus score ──
            const consensusScore = extractConsensusScore(aggregatedContent);

            if (consensusScore >= consensusThreshold * 100 || currentRound >= maxDebateRounds) {
                // Consensus reached or max rounds hit
                const details: CouncilDetails = {
                    individualResponses,
                    consensusScore: consensusScore / 100,
                    debateRounds: currentRound,
                    aggregatorModel: aggregatorModel.modelId,
                };

                // Remove the confidence tag from final content
                const cleanContent = aggregatedContent.replace(/\[CONFIDENCE:\s*\d+\]/gi, '').trim();
                callbacks.onComplete(details, cleanContent);
                return;
            }

            // Consensus not reached — continue debate
        }
    } catch (err: any) {
        callbacks.onError(`Council error: ${err.message}`);
    }
}

/**
 * Query all council members in parallel.
 */
async function queryCouncilMembers(
    userId: string,
    messages: LLMMessage[],
    models: ModelConfig[],
    callbacks: CouncilCallbacks
): Promise<CouncilIndividualResponse[]> {
    const promises = models.map(async (model) => {
        try {
            const result = await getCompletion({
                model: model.modelId,
                provider: model.provider,
                messages: [
                    ...(model.systemPrompt
                        ? [{ role: 'system' as const, content: model.systemPrompt }]
                        : []),
                    ...messages,
                ],
                temperature: model.temperature || 0.7,
                maxTokens: model.maxTokens || 4096,
                userId,
            });

            const response: CouncilIndividualResponse = {
                modelId: model.modelId,
                provider: model.provider,
                response: result.content,
                latencyMs: result.latencyMs,
            };

            callbacks.onIndividualResponse(response);
            return response;
        } catch (err: any) {
            const errorResponse: CouncilIndividualResponse = {
                modelId: model.modelId,
                provider: model.provider,
                response: `[Error: ${err.message}]`,
                latencyMs: 0,
            };
            callbacks.onIndividualResponse(errorResponse);
            return errorResponse;
        }
    });

    return Promise.all(promises);
}

/**
 * Build aggregation prompt from individual responses.
 */
function buildAggregationPrompt(
    originalQuery: string,
    responses: CouncilIndividualResponse[],
    round: number
): string {
    let prompt = `## Original Question\n${originalQuery}\n\n`;
    prompt += `## Council Responses (Round ${round})\n\n`;

    for (const r of responses) {
        prompt += `### ${r.modelId} (${r.provider})\n${r.response}\n\n`;
    }

    prompt += `## Your Task\nSynthesize the above responses into a single, comprehensive answer. Identify key points of agreement and any disagreements. Provide your final synthesized answer, followed by a confidence score.`;

    return prompt;
}

/**
 * Build messages for debate rounds (includes previous responses as context).
 */
function buildDebateMessages(
    originalMessages: LLMMessage[],
    previousResponses: CouncilIndividualResponse[],
    round: number
): LLMMessage[] {
    const debateContext = previousResponses
        .map((r) => `[${r.modelId}]: ${r.response}`)
        .join('\n\n');

    return [
        ...originalMessages,
        {
            role: 'user' as const,
            content: `The following responses were given in the previous round. Please review them, identify any errors or areas of disagreement, and provide an improved answer:\n\n${debateContext}`,
        },
    ];
}

/**
 * Extract the confidence score from the aggregator's response.
 */
function extractConsensusScore(content: string): number {
    const match = content.match(/\[CONFIDENCE:\s*(\d+)\]/i);
    if (match) {
        const score = parseInt(match[1], 10);
        return Math.min(100, Math.max(0, score));
    }
    return 75; // Default moderate confidence if not found
}
