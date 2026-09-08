import { GrammarSkillNode } from "@/domain/grammar/grammar-learning.schema";
import { AppError } from "@/lib/errors/app-error";

export class GrammarSkillRegistry {
  private readonly skills: Map<string, GrammarSkillNode> = new Map();
  private readonly subcategoryToSkillId: Map<string, string> = new Map();

  constructor() {
    this.registerDefaultSkillTree();
  }

  private registerDefaultSkillTree(): void {
    const defaultNodes: GrammarSkillNode[] = [
      // Root Node
      {
        id: "grammar_root",
        name: "English Grammar",
        category: "ROOT",
        parentId: null,
        subcategories: [],
        description: "Comprehensive English Grammar Knowledge Tree",
      },

      // Category 1: Verb Tenses
      {
        id: "cat_tenses",
        name: "Verb Tenses & Aspects",
        category: "Tenses",
        parentId: "grammar_root",
        subcategories: ["tense"],
        description: "Mastery over past, present, future, perfect, and continuous tenses",
      },
      {
        id: "tense_simple_past",
        name: "Simple Past Tense",
        category: "Tenses",
        parentId: "cat_tenses",
        subcategories: ["simple_past", "past_simple"],
        description: "Completed actions at specific times in the past",
        contrastivePartnerId: "tense_present_perfect",
      },
      {
        id: "tense_present_perfect",
        name: "Present Perfect Tense",
        category: "Tenses",
        parentId: "cat_tenses",
        subcategories: ["present_perfect"],
        description: "Past events with present relevance or ongoing timeframes",
        contrastivePartnerId: "tense_simple_past",
      },
      {
        id: "tense_past_perfect",
        name: "Past Perfect Tense",
        category: "Tenses",
        parentId: "cat_tenses",
        subcategories: ["past_perfect"],
        description: "Actions completed before another point in the past",
        contrastivePartnerId: "tense_simple_past",
      },

      // Category 2: Determiners & Articles
      {
        id: "cat_determiners",
        name: "Determiners & Articles",
        category: "Determiners",
        parentId: "grammar_root",
        subcategories: ["determiner"],
        description: "Articles, quantifiers, and demonstrative modifiers",
      },
      {
        id: "art_definite",
        name: "Definite Article (The)",
        category: "Determiners",
        parentId: "cat_determiners",
        subcategories: ["article", "definite_article"],
        description: "Specific nouns known to listener/reader",
        contrastivePartnerId: "art_zero",
      },
      {
        id: "art_zero",
        name: "Zero Article",
        category: "Determiners",
        parentId: "cat_determiners",
        subcategories: ["zero_article", "article_omission"],
        description: "General plural or uncountable nouns without articles",
        contrastivePartnerId: "art_definite",
      },

      // Category 3: Prepositions
      {
        id: "cat_prepositions",
        name: "Prepositions",
        category: "Prepositions",
        parentId: "grammar_root",
        subcategories: ["preposition"],
        description: "Spatial, temporal, and dependent prepositions",
      },
      {
        id: "prep_time",
        name: "Prepositions of Time (in/on/at)",
        category: "Prepositions",
        parentId: "cat_prepositions",
        subcategories: ["preposition_time"],
        description: "Time markers: 'in July', 'on Monday', 'at 5 PM'",
      },
      {
        id: "prep_dependent",
        name: "Dependent Prepositions",
        category: "Prepositions",
        parentId: "cat_prepositions",
        subcategories: ["dependent_preposition"],
        description: "Fixed verb/adjective preposition combinations (e.g. 'interested in')",
      },

      // Category 4: Agreement & Sentence Structure
      {
        id: "cat_agreement",
        name: "Subject-Verb Agreement",
        category: "Agreement",
        parentId: "grammar_root",
        subcategories: ["subject_verb_agreement", "agreement"],
        description: "Matching singular/plural subjects with verb forms",
      },
      {
        id: "cat_word_order",
        name: "Word Order & Clause Structure",
        category: "Syntax",
        parentId: "grammar_root",
        subcategories: ["word_order", "clause"],
        description: "Correct positioning of adverbs, indirect objects, and sub-clauses",
      },
    ];

    defaultNodes.forEach((node) => {
      this.skills.set(node.id, node);
      node.subcategories.forEach((subcat) => {
        this.subcategoryToSkillId.set(subcat.toLowerCase(), node.id);
      });
    });
  }

  public getSkill(skillId: string): GrammarSkillNode {
    const node = this.skills.get(skillId);
    if (!node) {
      throw AppError.notFound(`Grammar skill '${skillId}' not found in registry`);
    }
    return node;
  }

  public findSkillBySubcategory(subcategory: string): GrammarSkillNode | undefined {
    const skillId = this.subcategoryToSkillId.get(subcategory.toLowerCase());
    if (skillId) {
      return this.skills.get(skillId);
    }
    // Fallback search across names
    return Array.from(this.skills.values()).find(
      (node) => node.subcategories.includes(subcategory.toLowerCase()) || node.name.toLowerCase().includes(subcategory.toLowerCase())
    );
  }

  public getParentSkill(skillId: string): GrammarSkillNode | null {
    const child = this.getSkill(skillId);
    if (!child.parentId) return null;
    return this.getSkill(child.parentId);
  }

  public getChildSkills(parentId: string): GrammarSkillNode[] {
    return Array.from(this.skills.values()).filter((node) => node.parentId === parentId);
  }

  public getAncestorPath(skillId: string): GrammarSkillNode[] {
    const path: GrammarSkillNode[] = [];
    let current: GrammarSkillNode | null = this.getSkill(skillId);

    while (current) {
      path.unshift(current);
      current = current.parentId ? this.getSkill(current.parentId) : null;
    }

    return path;
  }

  public getContrastivePartner(skillId: string): GrammarSkillNode | null {
    const skill = this.getSkill(skillId);
    if (!skill.contrastivePartnerId) return null;
    return this.skills.get(skill.contrastivePartnerId) ?? null;
  }

  public getAllSkills(): GrammarSkillNode[] {
    return Array.from(this.skills.values());
  }
}

export const grammarSkillRegistry = new GrammarSkillRegistry();
