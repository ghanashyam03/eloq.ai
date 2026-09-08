import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export async function seedDatabase() {
  console.log("[Seed] Seeding canonical taxonomies...");

  // 1. Seed Error Definitions
  const errorDefinitions = [
    {
      code: "ARTICLE_MISSING",
      category: "grammar",
      name: "Missing Article",
      description: "Omission of required indefinite ('a'/'an') or definite ('the') article before a singular countable noun.",
      difficulty: "beginner",
    },
    {
      code: "PREPOSITION_INCORRECT",
      category: "grammar",
      name: "Incorrect Preposition",
      description: "Using an incorrect preposition for a given verb, adjective, or time phrase (e.g. 'depends of' instead of 'depends on').",
      difficulty: "intermediate",
    },
    {
      code: "TENSE_MISMATCH",
      category: "grammar",
      name: "Verb Tense Mismatch",
      description: "Using past simple when present perfect is required, or shifting tenses inappropriately in conversation.",
      difficulty: "intermediate",
    },
    {
      code: "SUBJECT_VERB_AGREEMENT",
      category: "grammar",
      name: "Subject-Verb Agreement Failure",
      description: "Mismatch between subject number and verb conjugation (e.g. 'She go' instead of 'She goes').",
      difficulty: "beginner",
    },
    {
      code: "UNNATURAL_PHRASING",
      category: "fluency",
      name: "Unnatural Word Order / Phrasal Choice",
      description: "Grammatically valid expression that sounds awkward or non-idiomatic to native speakers.",
      difficulty: "advanced",
    },
  ];

  for (const errDef of errorDefinitions) {
    await db.errorDefinition.upsert({
      where: { code: errDef.code },
      update: { name: errDef.name, description: errDef.description, category: errDef.category },
      create: errDef,
    });
  }

  // 2. Seed Grammar Skills
  const grammarSkills = [
    {
      code: "PRESENT_PERFECT_VS_PAST_SIMPLE",
      category: "tenses",
      topic: "Present Perfect vs. Past Simple",
      description: "Distinguishing between completed actions at a specific past time vs. unfinished actions or life experiences.",
      difficulty: "intermediate",
    },
    {
      code: "THIRD_PERSON_SINGULAR",
      category: "tenses",
      topic: "Third-Person Singular -s Endings",
      description: "Correctly adding -s / -es endings to present simple verbs with he/she/it subjects.",
      difficulty: "beginner",
    },
    {
      code: "RELATIVE_CLAUSES",
      category: "clauses",
      topic: "Defining & Non-Defining Relative Clauses",
      description: "Using 'who', 'which', and 'that' to connect clauses and provide essential or extra information.",
      difficulty: "intermediate",
    },
    {
      code: "SECOND_CONDITIONAL",
      category: "conditionals",
      topic: "Second Conditional (Hypothetical Present)",
      description: "Forming 'if + past simple ... would + infinitive' for imaginary situations.",
      difficulty: "intermediate",
    },
  ];

  for (const skill of grammarSkills) {
    await db.grammarSkill.upsert({
      where: { code: skill.code },
      update: { topic: skill.topic, description: skill.description, category: skill.category },
      create: skill,
    });
  }

  // 3. Seed Reference Vocabulary Items
  const vocabularyItems = [
    {
      word: "resilient",
      lemma: "resilient",
      definition: "Able to withstand or recover quickly from difficult conditions.",
      partOfSpeech: "adjective",
      pronunciation: "rɪˈzɪliənt",
      ipa: "/rɪˈzɪliənt/",
      register: "neutral",
      difficulty: "B2",
      collocations: ["resilient economy", "highly resilient"],
      synonyms: ["adaptable", "robust"],
      antonyms: ["fragile", "vulnerable"],
    },
    {
      word: "articulate",
      lemma: "articulate",
      definition: "Having or showing the ability to speak fluently and coherently.",
      partOfSpeech: "adjective",
      pronunciation: "ɑːrˈtɪkjələt",
      ipa: "/ɑːrˈtɪkjələt/",
      register: "formal",
      difficulty: "C1",
      collocations: ["articulate speaker", "clearly articulate"],
      synonyms: ["eloquent", "expressive"],
      antonyms: ["inarticulate", "hesitant"],
    },
    {
      word: "nuance",
      lemma: "nuance",
      definition: "A subtle difference in or shade of meaning, expression, or sound.",
      partOfSpeech: "noun",
      pronunciation: "ˈnuːɑːns",
      ipa: "/ˈnuːɑːns/",
      register: "academic",
      difficulty: "C1",
      collocations: ["subtle nuance", "cultural nuance"],
      synonyms: ["subtlety", "distinction"],
      antonyms: ["bluntness"],
    },
  ];

  for (const item of vocabularyItems) {
    await db.vocabularyItem.upsert({
      where: { word: item.word },
      update: { definition: item.definition, difficulty: item.difficulty },
      create: item,
    });
  }

  console.log("[Seed] Canonical taxonomies seeded successfully.");
}

if (process.env["NODE_ENV"] !== "test") {
  seedDatabase()
    .catch((e) => {
      console.error("[Seed Failure]", e);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
