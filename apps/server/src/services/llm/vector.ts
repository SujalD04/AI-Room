import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder() {
    if (!embedder) {
        // Use Supabase/gte-small which is fast, lightweight, and produces 384-dimensional vectors
        embedder = await pipeline('feature-extraction', 'Supabase/gte-small', {
            quantized: true,
        }) as FeatureExtractionPipeline;
    }
    return embedder;
}

/**
 * Generates a 384-dimensional vector embedding for a given text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const fn = await getEmbedder();
        const result = await fn(text, { pooling: 'mean', normalize: true });
        return Array.from(result.data);
    } catch (err: any) {
        console.error('Embedding error:', err.message);
        throw err;
    }
}
