import { NormalizedProduct, ProductScore, RankingResult } from './types';

// ============================================================================
// BM25 Scoring Helpers
// ============================================================================

const createEmptyScore = (
  product: NormalizedProduct,
  index: number
): ProductScore => ({
  id: product.id,
  score: 0,
  rank: index + 1,
  source: 'bm25' as const,
});

type TermContext = { docTerms: string[]; titleLower: string };

const getTermFrequency = (term: string, docTerms: string[]): number =>
  docTerms.filter(docTerm => docTerm.includes(term)).length;

const calculateTermScore = (term: string, ctx: TermContext): number => {
  const termFreq = getTermFrequency(term, ctx.docTerms);
  const titleBoost = ctx.titleLower.includes(term) ? 2 : 1;
  const exactBoost = ctx.docTerms.includes(term) ? 1.5 : 1;
  return termFreq * titleBoost * exactBoost;
};

const scoreProduct = (
  product: NormalizedProduct,
  queryTerms: string[]
): ProductScore => {
  const ctx: TermContext = {
    docTerms: product.doc_text.toLowerCase().split(/\s+/),
    titleLower: product.title.toLowerCase(),
  };
  const score = queryTerms.reduce(
    (total, term) => total + calculateTermScore(term, ctx),
    0
  );
  return { id: product.id, score, rank: 0, source: 'bm25' };
};

const assignRanks = (scores: ProductScore[]): ProductScore[] => {
  scores.sort((a, b) => b.score - a.score);
  scores.forEach((item, index) => {
    item.rank = index + 1;
  });
  return scores;
};

/**
 * Simple BM25-like scoring for text relevance
 */
export const scoreBM25 = (
  query: string,
  products: NormalizedProduct[]
): ProductScore[] => {
  if (!query.trim()) {
    return products.map(createEmptyScore);
  }

  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scores = products.map(product => scoreProduct(product, queryTerms));

  return assignRanks(scores);
};

// ============================================================================
// Semantic Scoring Helpers
// ============================================================================

type SemanticTerm = { terms: string[]; weight: number };

const SEMANTIC_TERMS: SemanticTerm[] = [
  { terms: ['ladder', 'escalera', 'step'], weight: 1.0 },
  { terms: ['platform', 'plataforma', 'elevadora'], weight: 1.0 },
  { terms: ['height', 'altura', 'high'], weight: 0.8 },
  { terms: ['safety', 'seguridad', 'safe'], weight: 0.8 },
  { terms: ['work', 'trabajo', 'professional'], weight: 0.6 },
  { terms: ['tool', 'herramienta', 'equipment'], weight: 0.6 },
];

type SemanticContext = { queryLower: string; docText: string };

const calculateSemanticTermScore = (
  ctx: SemanticContext,
  semanticTerm: SemanticTerm
): number => {
  const matchCount = semanticTerm.terms.filter(
    term => ctx.queryLower.includes(term) && ctx.docText.includes(term)
  ).length;
  return matchCount * semanticTerm.weight;
};

const getTypeBonus = (queryLower: string, productType?: string): number =>
  productType && queryLower.includes(productType.toLowerCase()) ? 0.5 : 0;

const getVendorBonus = (queryLower: string, vendor?: string): number =>
  vendor && queryLower.includes(vendor.toLowerCase()) ? 0.3 : 0;

const calculateBonusScore = (
  queryLower: string,
  product: NormalizedProduct
): number =>
  getTypeBonus(queryLower, product.product_type) +
  getVendorBonus(queryLower, product.vendor);

const scoreProductSemantic = (
  product: NormalizedProduct,
  queryLower: string
): ProductScore => {
  const ctx: SemanticContext = {
    queryLower,
    docText: product.doc_text.toLowerCase(),
  };
  const semanticScore = SEMANTIC_TERMS.reduce(
    (total, term) => total + calculateSemanticTermScore(ctx, term),
    0
  );
  return {
    id: product.id,
    score: semanticScore + calculateBonusScore(queryLower, product),
    rank: 0,
    source: 'semantic',
  };
};

/**
 * Simple semantic similarity scoring (placeholder)
 */
export const scoreSemanticSimilarity = (
  query: string,
  products: NormalizedProduct[]
): ProductScore[] => {
  const queryLower = query.toLowerCase();
  const scores = products.map(product =>
    scoreProductSemantic(product, queryLower)
  );
  return assignRanks(scores);
};

// ============================================================================
// Rank Fusion Helpers
// ============================================================================

const collectProductIds = (rankings: ProductScore[][]): Set<number> => {
  const ids = new Set<number>();
  rankings.forEach(ranking => ranking.forEach(item => ids.add(item.id)));
  return ids;
};

type RRFContext = { rankings: ProductScore[][]; k: number };

const calculateRRFScore = (productId: number, ctx: RRFContext): number =>
  ctx.rankings.reduce((score, ranking) => {
    const item = ranking.find(r => r.id === productId);
    return item ? score + 1 / (ctx.k + item.rank) : score;
  }, 0);

/**
 * Reciprocal Rank Fusion (RRF) to combine multiple ranking algorithms
 */
export const fuseRankings = (
  rankings: ProductScore[][],
  k: number = 60
): ProductScore[] => {
  const ctx: RRFContext = { rankings, k };
  const result = Array.from(collectProductIds(rankings)).map(id => ({
    id,
    score: calculateRRFScore(id, ctx),
    rank: 0,
    source: 'fused' as const,
  }));
  return assignRanks(result);
};

/**
 * Rank products using hybrid approach (BM25 + Semantic + RRF)
 * @param query - Search query
 * @param products - Products to rank
 * @returns Ranking result with debug information
 */
export const rankProducts = (
  query: string,
  products: NormalizedProduct[]
): RankingResult => {
  // Get BM25 scores
  const bm25Scores = scoreBM25(query, products);

  // Get semantic scores
  const semanticScores = scoreSemanticSimilarity(query, products);

  // Fuse rankings using RRF
  const fusedScores = fuseRankings([bm25Scores, semanticScores]);

  return {
    scores: fusedScores,
    total_candidates: products.length,
    algorithm_used: 'hybrid_bm25_semantic_rrf',
  };
};
