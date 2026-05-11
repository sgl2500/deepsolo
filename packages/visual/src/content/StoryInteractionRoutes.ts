import type { StoryCondition } from '../types';
import type { GameStore } from '../core/GameStore';
import { evaluateAllConditions } from '../data/StoryRegistry';

export interface StoryInteractionRoute {
  actorId: string;
  buildingId: string;
  storyId: string;
  conditions: StoryCondition[];
}

const STORY_INTERACTION_ROUTES: StoryInteractionRoute[] = [
  {
    actorId: 'digital_master',
    buildingId: 'digital_sect',
    storyId: 'main_digital_master_trial_complete',
    conditions: [
      { type: 'flag_is', params: { flag: 'main.digital_master_trial.demo_done', value: true } },
      { type: 'flag_not_set', params: { flag: 'main.digital_master_trial.completed' } },
    ],
  },
  {
    actorId: 'digital_master',
    buildingId: 'digital_sect',
    storyId: 'main_digital_master_trial_intro',
    conditions: [
      { type: 'flag_is', params: { flag: 'story.observer_awake', value: true } },
      { type: 'flag_not_set', params: { flag: 'main.digital_master_trial.started' } },
      { type: 'flag_not_set', params: { flag: 'main.digital_master_trial.completed' } },
    ],
  },
];

export function findStoryInteractionRoute(
  buildingId: string | null | undefined,
  actorId: string,
  store: GameStore,
): StoryInteractionRoute | null {
  if (!buildingId) return null;
  return STORY_INTERACTION_ROUTES.find((route) => (
    route.buildingId === buildingId &&
    route.actorId === actorId &&
    evaluateAllConditions(route.conditions, store)
  )) ?? null;
}
