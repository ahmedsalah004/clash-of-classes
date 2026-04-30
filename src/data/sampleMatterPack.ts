import type { Pack, Question } from '../types/game';

const points = [100, 200, 300, 400] as const;

function makeQuestions(categoryId: string, prompts: string[]): Question[] {
  return prompts.map((prompt, index) => ({
    id: `${categoryId}-${points[index]}`,
    categoryId,
    points: points[index],
    prompt,
    answer: `Model answer for ${prompt}`,
    hint: `Think about key vocabulary in ${categoryId.replace(/-/g, ' ')}.`,
    mcqOptions: ['Option A', 'Option B', 'Option C', 'Option D'],
    twoAnswersOptions: ['Option A', 'Option C'],
  }));
}

export const sampleMatterPack: Pack = {
  id: 'states-properties-matter-review-battle',
  title: 'States and Properties of Matter Review Battle',
  stageLabel: 'Cambridge Stage 5',
  subjectLabel: 'Year 5 Science',
  categories: [
    { id: 'states-of-matter', title: 'States of Matter', questions: makeQuestions('states-of-matter', ['Name the three states of matter.', 'Describe particle spacing in solids.', 'Explain why gases are compressible.', 'Compare particle movement in liquids and gases.']) },
    { id: 'changes-of-state', title: 'Changes of State', questions: makeQuestions('changes-of-state', ['What is melting?', 'What is evaporation?', 'How is condensation different from freezing?', 'Explain the water cycle state changes.']) },
    { id: 'heating-cooling', title: 'Heating & Cooling', questions: makeQuestions('heating-cooling', ['What happens when ice is heated?', 'Why do puddles disappear?', 'How does cooling affect particle energy?', 'Predict what happens to steam when cooled.']) },
    { id: 'materials', title: 'Material Properties', questions: makeQuestions('materials', ['Define transparent material.', 'Give one flexible material.', 'Why is metal used for pans?', 'Choose a material for a raincoat and explain.']) },
    { id: 'separating-mixtures', title: 'Separating Mixtures', questions: makeQuestions('separating-mixtures', ['How can you separate sand from water?', 'What is filtration?', 'How can salt be recovered from saltwater?', 'Plan how to separate cereal, rice, and paper clips.']) },
    { id: 'real-life-applications', title: 'Real-Life Applications', questions: makeQuestions('real-life-applications', ['Name one use of evaporation in daily life.', 'Why are windows double-glazed?', 'How do refrigerators use cooling?', 'Explain how deodorant spray relates to gases.']) },
  ],
};
