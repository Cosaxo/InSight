// ─── Personality & Profile ───────────────────────────────────────────
export interface PersonalityTraits {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface PoliticalProfile {
  economic: number;    // -100 (left) to 100 (right)
  social: number;      // -100 (libertarian) to 100 (authoritarian)
  environmental: number; // 0-100
  globalism: number;     // 0-100
}

// ─── World ──────────────────────────────────────────────────────────
export interface GlobalConnection {
  id: string;
  name: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  strength: number; // 0-100
  type: 'friend' | 'colleague' | 'family' | 'acquaintance';
}

export interface CulturalAffinity {
  culture: string;
  score: number;
  color: string;
}

export interface WorldNewsInterest {
  topic: string;
  level: number; // 0-100
  category: string;
}

// ─── City ───────────────────────────────────────────────────────────
export interface CityVisit {
  id: string;
  name: string;
  country: string;
  rating: number;       // 1-5
  daysSpent: number;
  visitDate: string;
  impression: string;
  tags: string[];
  scores: CityScores;
  lat: number;
  lng: number;
}

export interface CityScores {
  food: number;
  culture: number;
  nightlife: number;
  safety: number;
  affordability: number;
  nature: number;
  architecture: number;
  people: number;
}

export interface CityDNA {
  trait: string;
  value: number;
}

// ─── Interests & Groups ─────────────────────────────────────────────
export interface Interest {
  id: string;
  name: string;
  category: string;
  level: number;        // 0-100 proficiency
  hoursPerWeek: number;
  startedYear: number;
  color: string;
}

export interface Group {
  id: string;
  name: string;
  type: 'online' | 'local' | 'professional';
  members: number;
  engagement: number; // 0-100
  joinedDate: string;
}

export interface SkillNode {
  id: string;
  name: string;
  level: number;
  parent?: string;
  children?: string[];
}

export interface InterestEvolution {
  month: string;
  [interest: string]: number | string;
}

// ─── Nearby ─────────────────────────────────────────────────────────
export interface NearbyPlace {
  id: string;
  name: string;
  type: 'cafe' | 'park' | 'restaurant' | 'shop' | 'gym' | 'library' | 'bar' | 'museum';
  rating: number;
  visits: number;
  distance: string;
  favorite: boolean;
}

export interface LocalEvent {
  id: string;
  title: string;
  date: string;
  type: string;
  attending: boolean;
  attendees: number;
}

export interface NeighborhoodScore {
  category: string;
  score: number;
  icon: string;
}

// ─── Friends ────────────────────────────────────────────────────────
export interface Friend {
  id: string;
  name: string;
  avatar: string;
  metDate: string;
  strength: number;     // 0-100
  sharedInterests: string[];
  communicationFreq: number; // messages per week
  category: 'close' | 'regular' | 'casual' | 'distant';
  city: string;
}

export interface SocialCircle {
  name: string;
  count: number;
  color: string;
}

export interface CommunicationPattern {
  day: string;
  messages: number;
  calls: number;
  meetups: number;
}

export interface DiversityIndex {
  dimension: string;
  score: number;
  description: string;
}

// ─── Time Usage ─────────────────────────────────────────────────────
export interface TimeBlock {
  category: string;
  hours: number;
  color: string;
  icon: string;
}

// ─── Tab Categories ─────────────────────────────────────────────────
export type TabCategory = 'world' | 'city' | 'interests' | 'nearby' | 'friends';

export interface TabConfig {
  id: TabCategory;
  label: string;
  icon: string;
  color: string;
  gradient: string;
}
