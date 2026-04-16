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
}
