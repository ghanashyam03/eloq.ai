import { PersonalInsight } from "@/domain/progress/progress-analytics.schema";

export interface ContextualErrorData {
  writingWords: number;
  writingArticleErrors: number;
  speakingWords: number;
  speakingArticleErrors: number;
  passiveVocabGrowth: number;
  activeVocabGrowth: number;
}

export class InsightGenerator {
  /**
   * Generates evidence-backed personal insights comparing performance across modalities and contexts.
   */
  public generateInsights(data: ContextualErrorData): PersonalInsight[] {
    const insights: PersonalInsight[] = [];

    // 1. Modality Comparison Insight (Writing vs Speaking Article Errors)
    if (data.writingWords >= 100 && data.speakingWords >= 100) {
      const writingArticleRate = (data.writingArticleErrors / data.writingWords) * 1000;
      const speakingArticleRate = (data.speakingArticleErrors / data.speakingWords) * 1000;

      if (speakingArticleRate > writingArticleRate * 1.5 && speakingArticleRate > 4.0) {
        const percentLessInWriting = Math.round(
          ((speakingArticleRate - writingArticleRate) / speakingArticleRate) * 100
        );

        insights.push({
          id: crypto.randomUUID(),
          category: "comparison",
          headline: "Fewer Grammatical Errors in Writing than Speaking",
          detailedObservation: `You make ${percentLessInWriting}% fewer article errors during writing (${Math.round(writingArticleRate)} per 1,000 words) than during real-time speaking (${Math.round(speakingArticleRate)} per 1,000 words).`,
          supportingEvidence: {
            writingArticleRatePer1000: Math.round(writingArticleRate * 10) / 10,
            speakingArticleRatePer1000: Math.round(speakingArticleRate * 10) / 10,
            writingWordCount: data.writingWords,
            speakingWordCount: data.speakingWords,
          },
          generatedAt: new Date(),
        });
      }
    }

    // 2. Passive vs Active Vocabulary Growth Insight
    if (data.passiveVocabGrowth > 5 && data.activeVocabGrowth >= 0) {
      const ratio = data.activeVocabGrowth / Math.max(data.passiveVocabGrowth, 1);
      if (ratio < 0.3) {
        insights.push({
          id: crypto.randomUUID(),
          category: "vocabulary",
          headline: "Active Vocabulary Lagging Passive Recognition",
          detailedObservation: `Your active vocabulary (+${data.activeVocabGrowth} words) is increasing significantly slower than your passive recognition (+${data.passiveVocabGrowth} words). Focus on active sentence production exercises.`,
          supportingEvidence: {
            passiveGrowthCount: data.passiveVocabGrowth,
            activeGrowthCount: data.activeVocabGrowth,
            conversionRatio: Math.round(ratio * 100) / 100,
          },
          generatedAt: new Date(),
        });
      }
    }

    return insights;
  }
}

export const insightGenerator = new InsightGenerator();
