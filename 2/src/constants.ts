// 20,000 Light Years Into Space — TypeScript port
// Original: Copyright (C) Jack Whitham 2006-26, GPL v2

export type GridPos = { x: number; y: number };
export type FloatPos = { x: number; y: number };
export type Colour = [number, number, number];

export const GRID_W = 50;
export const GRID_H = 50;
export const GRID_CENTRE: GridPos = { x: 25, y: 25 };

export const FRAME_RATE = 35;
export const RT_FRAME_LENGTH = 1.0 / FRAME_RATE;

// Steam physics
export const INITIAL_NODE_CAPACITY = 50;
export const CAPACITY_UPGRADE = 15;
export const RESISTANCE_FACTOR = 0.55;
export const WORK_STEAM_DEMAND = 4.52;
export const STATIC_STEAM_DEMAND = 2.85;

// Work and health
export const HEALTH_UNIT = 10;
export const WORK_UNIT_SIZE = 1;
export const NODE_HEALTH_UNITS = 20;
export const STORM_DAMAGE = 1;

// Upgrades
export const NODE_MAX_TECH_LEVEL = 5;
export const NODE_UPGRADE_WORK = 10;
export const CITY_UPGRADE_WORK = 15;
export const PIPE_MAX_TECH_LEVEL = 3;
export const PIPE_UPGRADE_WORK_FACTOR = 1.0;
export const PIPE_UPGRADE_RESISTANCE_FACTOR = 0.8;

// Timing
export const LENGTH_OF_SEASON = 120; // game seconds

// Pressure thresholds
export const PRESSURE_DANGER = 4.0;
export const PRESSURE_WARNING = 6.0;
export const PRESSURE_OK = 8.0;
export const PRESSURE_GOOD = 10.0;

// Display
export const MINIMUM_WIDTH = 920;
export const MINIMUM_HEIGHT = 690;
export const EXPECTED_ASPECT = 1024 / 768;
export const CITY_BOX_SIZE = 10;
export const CITY_COLOUR: Colour = [192, 128, 0];

// Math
export const TWO_PI = Math.PI * 2;
export const TWO_THIRDS_PI = (Math.PI * 2) / 3;

export enum Season {
  QUIET = 'QUIET',
  STORM = 'STORM',
  ALIEN = 'ALIEN',
  QUAKE = 'QUAKE',
  START = 'START',
}

export enum MenuCommand {
  BUILD_NODE = 'BUILD_NODE',
  BUILD_PIPE = 'BUILD_PIPE',
  DESTROY = 'DESTROY',
  UPGRADE = 'UPGRADE',
  NEUTRAL = 'NEUTRAL',
  OPEN_MENU = 'OPEN_MENU',
  SAVE = 'SAVE',
  LOAD = 'LOAD',
  QUIT = 'QUIT',
  NEW_GAME = 'NEW_GAME',
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  EXPERT = 'EXPERT',
  PEACEFUL = 'PEACEFUL',
  TUTORIAL = 'TUTORIAL',
  FAST_FORWARD = 'FAST_FORWARD',
  MUTE = 'MUTE',
}

export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT' | 'PEACEFUL';

export interface DifficultySettings {
  DAMAGE_FACTOR: number;
  CITY_UPGRADE_WORK_PER_LEVEL: number;
  GRACE_TIME: number;
  CITY_MAX_TECH_LEVEL: number;
  BASIC_STEAM_PRODUCTION: number;
  STEAM_PRODUCTION_PER_LEVEL: number;
}

export function getDifficulty(level: Difficulty): DifficultySettings {
  if (level === 'BEGINNER') {
    return { DAMAGE_FACTOR: 1.0, CITY_UPGRADE_WORK_PER_LEVEL: 2, GRACE_TIME: 20, CITY_MAX_TECH_LEVEL: 9, BASIC_STEAM_PRODUCTION: 10, STEAM_PRODUCTION_PER_LEVEL: 6 };
  } else if (level === 'INTERMEDIATE' || level === 'PEACEFUL') {
    return { DAMAGE_FACTOR: 1.4, CITY_UPGRADE_WORK_PER_LEVEL: 3, GRACE_TIME: 10, CITY_MAX_TECH_LEVEL: 12, BASIC_STEAM_PRODUCTION: 6, STEAM_PRODUCTION_PER_LEVEL: 4 };
  } else {
    return { DAMAGE_FACTOR: 1.7, CITY_UPGRADE_WORK_PER_LEVEL: 4, GRACE_TIME: 5, CITY_MAX_TECH_LEVEL: 15, BASIC_STEAM_PRODUCTION: 4, STEAM_PRODUCTION_PER_LEVEL: 3 };
  }
}

export type StatTuple = { colour: Colour | null; size: number | null; text?: string; bar?: BarMeter };
export type BarMeter = { current: number; currentColour: Colour; max: number; maxColour: Colour };

export const ASSET_MAP: Record<string, string> = {
  back: 'back_jpg',
  bolt: 'bolt_png',
  bricks: 'bricks_png',
  bricks2: 'bricks2_png',
  city1: 'city1_png',
  destroy: 'destroy_png',
  fastforward: 'fastforward_png',
  greenrust: 'greenrust_jpg',
  header: 'header_jpg',
  headersm: 'headersm_jpg',
  letters: 'letters_png',
  mainmenu: 'mainmenu_jpg',
  maker: 'maker_png',
  maker_u: 'maker_u_png',
  menuicon: 'menuicon_png',
  node: 'node_png',
  node_u: 'node_u_png',
  rivets: 'rivets_jpg',
  stormsample: 'stormsample_png',
  upgrade: 'upgrade_png',
  well: 'well_png',
  i006metal: '006metal_jpg',
};

export const SOUND_MAP: Record<string, string> = {
  bamboo: 'ack1_ogg', bamboo1: 'ack2_ogg', bamboo2: 'ack3_ogg',
  crisp: 'ack4_ogg', destroy: 'ack5_ogg', double: 'ack6_ogg',
  mechanical_1: 'ack7_ogg', ring: 'ack8_ogg', whoosh1: 'ack9_ogg',
  emergency: 'alert1_ogg', stormbeeps: 'alert2_ogg', firealrm: 'alert3_ogg',
  clicker: 'aliens_ogg', aliensappr: 'aliensappr_ogg', alient2: 'alient2_ogg',
  applause: 'dack1_ogg', computer: 'dack2_ogg',
  cityups: 'cityups_ogg', click: 'click_ogg', click_s: 'click_s_ogg',
  earthquake: 'earthquake_ogg', error: 'error_ogg', krankor: 'krankor_ogg',
  quakewarn: 'quakewarn_ogg', steamcrit: 'steamcrit_ogg', steamres: 'steamres_ogg',
  stormdmg: 'stormdmg_ogg', stormwarn: 'stormwarn_ogg',
};
