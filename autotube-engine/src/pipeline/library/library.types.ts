export interface CharacterOutfit {
  id: string;
  description: string;
}

export interface CharacterBible {
  id: string;
  name: string;
  /** Descripción textual inyectada al prompt del LLM (sección 3.3.2). */
  description: string;
  subjectId: string;
  outfits: CharacterOutfit[];
}
