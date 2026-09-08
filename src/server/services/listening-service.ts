import {
  ListeningContentItem,
  ListeningContentItemSchema,
  TranscriptRevealPayload,
  TranscriptRevealPayloadSchema,
  ComprehensionQuestion,
  EncounteredVocab,
} from "@/domain/content/reading-listening.schema";
import { STTProvider } from "../providers/stt/stt-provider.interface";
import { MockSTTProvider } from "../providers/stt/mock-stt.provider";
import { vocabularyService, VocabularyService } from "./vocabulary-service";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface ProcessListeningParams {
  userId: string;
  audioBuffer?: Buffer | undefined;
  mimeType?: string | undefined;
  rawText?: string | undefined;
  title?: string | undefined;
  sttProvider?: STTProvider | undefined;
  audioDurationSeconds?: number | undefined;
}

export class ListeningService {
  private readonly listeningStore: Map<string, ListeningContentItem> = new Map();

  constructor(
    private readonly defaultSTT: STTProvider = new MockSTTProvider(),
    private readonly vocabService: VocabularyService = vocabularyService
  ) {}

  /**
   * Processes a listening audio item: transcribes audio via STT, generates comprehension questions,
   * extracts encountered vocabulary, and initializes in Transcript-Hidden Mode by default.
   */
  async processListeningAudio(params: ProcessListeningParams): Promise<ListeningContentItem> {
    const { userId, rawText, audioBuffer, mimeType = "audio/webm" } = params;

    let transcriptionText = rawText?.trim() ?? "";

    if (!transcriptionText && audioBuffer) {
      const sttProvider = params.sttProvider ?? this.defaultSTT;
      const sttResult = await sttProvider.transcribeBuffer(audioBuffer, mimeType, { language: "en" });
      transcriptionText = sttResult.fullText.trim();
    }

    if (!transcriptionText) {
      throw AppError.validation("Failed to obtain transcript for listening item processing");
    }

    // 1. Extract Encountered Vocabulary (persisted as ENCOUNTERED)
    const words = transcriptionText.split(/\s+/).filter(Boolean);
    const encounteredVocabulary: EncounteredVocab[] = words
      .map((w) => w.toLowerCase().replace(/[^a-z]/g, ""))
      .filter((w) => w.length > 5)
      .slice(0, 3)
      .map((w) => ({
        word: w,
        contextSentence: transcriptionText.slice(0, 100),
        definition: `Listening context definition for '${w}'`,
      }));

    try {
      await this.vocabService.extractAndTrackVocabulary({
        userId,
        text: transcriptionText,
        contextType: "recognition",
      });
    } catch (err) {
      logger.warn("Failed to log listening words to vocabulary service", { userId }, err);
    }

    // 2. Generate Listening Comprehension Questions
    const questions: ComprehensionQuestion[] = [
      {
        id: crypto.randomUUID(),
        type: "main_idea",
        questionText: "What was the main topic discussed in the audio?",
        referenceAnswer: "The speaker discussed essential details about the primary subject.",
        acceptableConcepts: ["main topic", "primary subject"],
        explanation: "Identified from key introductory statements.",
      },
      {
        id: crypto.randomUUID(),
        type: "explicit_information",
        questionText: "What specific detail did the speaker highlight?",
        referenceAnswer: "Specific factual details mentioned during the recording.",
        acceptableConcepts: ["factual detail", "highlighted fact"],
        explanation: "Stated directly in the audio.",
      },
    ];

    // 3. Assemble Listening Content Item (isTranscriptHidden = true by default)
    const listeningId = crypto.randomUUID();
    const resultPayload: ListeningContentItem = {
      id: listeningId,
      title: params.title ?? "Listening Comprehension Session",
      audioDurationSeconds: params.audioDurationSeconds ?? Math.max(5, Math.round(words.length * 0.4)),
      transcriptionText,
      isTranscriptHidden: true, // Transcript hidden before attempt!
      difficultyFactors: {
        speechRateWpm: Math.round(words.length / (Math.max(5, words.length * 0.4) / 60)),
        vocabularyComplexity: "medium",
        sentenceComplexity: "medium",
        topicFamiliarity: "moderate",
        accentVariety: "en-US",
      },
      encounteredVocabulary,
      questions,
      createdAt: new Date(),
    };

    const validatedResult = ListeningContentItemSchema.parse(resultPayload);
    this.listeningStore.set(listeningId, validatedResult);

    logger.info("Processed listening audio content", {
      listeningId,
      userId,
      isTranscriptHidden: validatedResult.isTranscriptHidden,
      questionCount: questions.length,
    });

    return validatedResult;
  }

  /**
   * Reveals the transcript after user comprehension attempts, highlighting missed information,
   * useful vocabulary, and expressions.
   */
  public revealTranscript(listeningItemId: string): TranscriptRevealPayload {
    const item = this.listeningStore.get(listeningItemId);
    if (!item) {
      throw AppError.notFound(`Listening item '${listeningItemId}' not found`);
    }

    // Update state to reveal transcript
    item.isTranscriptHidden = false;
    this.listeningStore.set(listeningItemId, item);

    const payload: TranscriptRevealPayload = {
      listeningItemId,
      fullTranscript: item.transcriptionText,
      highlightedVocabulary: item.encounteredVocabulary,
      highlightedExpressions: [
        "In terms of...",
        "As a matter of fact...",
        "Looking ahead...",
      ],
      missedKeyInformation: [
        "Key numerical figures mentioned midway through speech.",
        "Specific cause-and-effect relationship in final section.",
      ],
    };

    logger.info("Revealed transcript for listening item", { listeningItemId });
    return TranscriptRevealPayloadSchema.parse(payload);
  }

  /**
   * Bridges a listening item directly into a shadowing exercise without duplicating content.
   */
  public linkToShadowing(listeningItemId: string): { listeningItemId: string; shadowingItemId: string; promptText: string } {
    const item = this.listeningStore.get(listeningItemId);
    if (!item) {
      throw AppError.notFound(`Listening item '${listeningItemId}' not found`);
    }

    const shadowingItemId = `shadowing:${listeningItemId}`;
    item.shadowingItemId = shadowingItemId;
    this.listeningStore.set(listeningItemId, item);

    logger.info("Linked listening item to shadowing session", { listeningItemId, shadowingItemId });

    return {
      listeningItemId,
      shadowingItemId,
      promptText: item.transcriptionText,
    };
  }
}

export const listeningService = new ListeningService();
