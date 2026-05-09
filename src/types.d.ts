import { Animation, Image } from './objects';

export type EnemyBuilderData = {
    name: string;
    description: string;
    health: number;
    health_range: [number, number];
    health_regen: number;
    attack_speed: number;
    attack_speed_range: [number, number];
    attack_speed_strategy: string;
    primary_attack: string | null;
    secondary_attack: string | null;
    tertiary_attack: string | null;
    seed: number;
    assets: string[];
    attack_animation: string[];
};

export interface Effect {
    name: string;
    type: string;
    duration: number;
    health_regen?: number;
    damage_reduction?: number;
    damage_per_tick?: number;
    until_cured?: boolean;
    tick_interval?: number;
    remaining?: number;
    accuracy_penalty_percent?: number;
    disabled?: boolean;
    immobilized?: boolean;
    damage_taken_multiplier?: number;
    always_hit?: boolean;
    reduce_by_ticks?: number;
    reduced_healing?: boolean;
}
