import { ScenarioDefinition } from "@/domain/speech/speaking-simulation.schema";
import { AppError } from "@/lib/errors/app-error";

export class ScenarioRegistry {
  private readonly scenarios: Map<string, ScenarioDefinition> = new Map();

  constructor() {
    this.registerDefaultScenarios();
  }

  private registerDefaultScenarios(): void {
    const templates: ScenarioDefinition[] = [
      // 1. Job Interview Simulation
      {
        id: "sim_interview_tech",
        type: "interview",
        title: "Senior Tech Role Behavioral Interview",
        objective: "Evaluate leadership, technical decision-making, and communication under questioning.",
        roleConfiguration: {
          aiRole: "interviewer",
          userRole: "Job Candidate",
          tone: "professional",
          behavioralRules: [
            "Ask realistic behavioral and technical situational questions.",
            "Listen to candidate responses and ask direct follow-ups referencing their exact claims.",
            "Challenge vague, generic, or incomplete answers politely.",
            "Never repeat questions already asked.",
          ],
        },
        difficulty: "B2",
        topic: "Software Architecture & Team Leadership",
        constraints: ["Keep turns concise (1-2 questions per turn)", "Do not give away answers"],
        evaluationDimensions: ["relevance", "clarity", "structure", "conciseness", "grammar", "vocabulary", "naturalness"],
        targetSkills: ["professional_english", "fluency", "vocabulary"],
      },

      // 2. Debate Mode
      {
        id: "sim_debate_ai_ethics",
        type: "debate",
        title: "Debate: Mandatory AI Regulation",
        objective: "Defend your position against an active opposing debater using evidence and clear argumentation.",
        roleConfiguration: {
          aiRole: "debater",
          userRole: "Debate Participant",
          tone: "challenging",
          opposingStance: "AI development must be strictly regulated by international law to prevent economic displacement and safety hazards.",
          behavioralRules: [
            "Maintain an active, firm opposing stance throughout the debate.",
            "Directly address the user's specific arguments rather than giving canned statements.",
            "Challenge unsupported assertions and request concrete evidence.",
            "Avoid turning the debate into an essay reading.",
          ],
        },
        difficulty: "C1",
        topic: "Artificial Intelligence Regulation & Societal Impact",
        constraints: ["State counterarguments directly", "Limit AI turns to 3-4 clear sentences"],
        evaluationDimensions: ["relevance", "structure", "vocabulary", "naturalness", "clarity"],
        targetSkills: ["academic_english", "vocabulary", "fluency"],
      },

      // 3. Presentation Mode & Q&A
      {
        id: "sim_presentation_keynote",
        type: "presentation",
        title: "Product Strategy Keynote & Q&A",
        objective: "Deliver a structured presentation and field challenging audience Q&A questions.",
        roleConfiguration: {
          aiRole: "presentation_audience",
          userRole: "Presenter",
          tone: "formal",
          behavioralRules: [
            "Allow presenter to deliver opening, transitions, and conclusion.",
            "Ask pertinent, constructive Q&A questions evaluating clarity, structure, and pace.",
            "Track filler word usage and transitions between key ideas.",
          ],
        },
        difficulty: "B2",
        topic: "Quarterly Product Strategy & Expansion Plan",
        constraints: ["Act as engaged stakeholder", "Ask targeted Q&A after presentation segments"],
        evaluationDimensions: ["structure", "clarity", "conciseness", "naturalness", "fluency"],
        targetSkills: ["professional_english", "fluency", "grammar"],
      },

      // 4. Roleplay Mode
      {
        id: "sim_roleplay_client",
        type: "roleplay",
        title: "Difficult Client Project Negotiation",
        objective: "Navigate scope creep and project deadlines with a demanding client while preserving relationship.",
        roleConfiguration: {
          aiRole: "client",
          userRole: "Project Lead",
          tone: "collaborative",
          behavioralRules: [
            "Embody a client concerned about budget and tight delivery timelines.",
            "Push back on vague promises; request concrete deliverables and timeline adjustments.",
          ],
        },
        difficulty: "B2",
        topic: "Software Project Scope & Timeline Adjustment",
        constraints: ["Stay in character", "Respond realistically to client concerns"],
        evaluationDimensions: ["naturalness", "vocabulary", "clarity", "relevance"],
        targetSkills: ["professional_english", "naturalness"],
      },

      // 5. Academic Discussion Mode
      {
        id: "sim_academic_seminar",
        type: "academic_discussion",
        title: "University Research Methodology Seminar",
        objective: "Discuss research methodology, theoretical frameworks, and academic literature with a professor.",
        roleConfiguration: {
          aiRole: "professor",
          userRole: "Graduate Student",
          tone: "academic",
          behavioralRules: [
            "Probe methodological choices and theoretical assumptions.",
            "Encourage precise academic vocabulary and formal hedging (e.g. 'the evidence suggests').",
          ],
        },
        difficulty: "C1",
        topic: "Empirical Research Methods & Quantitative Analysis",
        constraints: ["Use academic register", "Challenge methodological limitations"],
        evaluationDimensions: ["structure", "vocabulary", "clarity", "grammar"],
        targetSkills: ["academic_english", "vocabulary", "grammar"],
      },

      // 6. Professional Scenario Mode
      {
        id: "sim_pro_cross_functional",
        type: "professional_scenario",
        title: "Cross-Functional Executive Alignment",
        objective: "Align conflicting departmental priorities between engineering, product, and sales.",
        roleConfiguration: {
          aiRole: "manager",
          userRole: "Engineering Manager",
          tone: "professional",
          behavioralRules: [
            "Represent executive leadership seeking clear trade-offs and business rationale.",
            "Require clear risk assessments and resource trade-offs.",
          ],
        },
        difficulty: "B2",
        topic: "Quarterly Resource Allocation & Engineering Priorities",
        constraints: ["Focus on business outcomes", "Maintain professional decorum"],
        evaluationDimensions: ["relevance", "clarity", "conciseness", "structure"],
        targetSkills: ["professional_english", "fluency"],
      },
    ];

    templates.forEach((s) => this.scenarios.set(s.id, s));
  }

  public getScenario(scenarioId: string): ScenarioDefinition {
    const s = this.scenarios.get(scenarioId);
    if (!s) {
      throw AppError.notFound(`Scenario definition '${scenarioId}' not found in registry`);
    }
    return s;
  }

  public findScenarioByType(type: string): ScenarioDefinition | undefined {
    return Array.from(this.scenarios.values()).find((s) => s.type === type || s.id.includes(type));
  }

  public getAllScenarios(): ScenarioDefinition[] {
    return Array.from(this.scenarios.values());
  }
}

export const scenarioRegistry = new ScenarioRegistry();
