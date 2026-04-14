import type {
  PersonalityTraits,
  PoliticalProfile,
  GlobalConnection,
  CulturalAffinity,
  WorldNewsInterest,
  CityVisit,
  CityDNA,
  Interest,
  Group,
  InterestEvolution,
  NearbyPlace,
  LocalEvent,
  NeighborhoodScore,
  Friend,
  SocialCircle,
  CommunicationPattern,
  DiversityIndex,
  TimeBlock,
} from '../types';

// ─── Personality ────────────────────────────────────────────────────
export const personalityTraits: PersonalityTraits = {
  openness: 82,
  conscientiousness: 68,
  extraversion: 55,
  agreeableness: 74,
  neuroticism: 35,
};

export const politicalProfile: PoliticalProfile = {
  economic: -15,
  social: -25,
  environmental: 78,
  globalism: 72,
};

// ─── Time Usage ─────────────────────────────────────────────────────
export const timeUsage: TimeBlock[] = [
  { category: 'Work', hours: 42, color: '#6366f1', icon: 'Briefcase' },
  { category: 'Sleep', hours: 49, color: '#8b5cf6', icon: 'Moon' },
  { category: 'Social', hours: 14, color: '#ec4899', icon: 'Users' },
  { category: 'Exercise', hours: 7, color: '#10b981', icon: 'Dumbbell' },
  { category: 'Learning', hours: 10, color: '#f59e0b', icon: 'BookOpen' },
  { category: 'Hobbies', hours: 12, color: '#06b6d4', icon: 'Palette' },
  { category: 'Transit', hours: 8, color: '#64748b', icon: 'Car' },
  { category: 'Other', hours: 26, color: '#94a3b8', icon: 'MoreHorizontal' },
];

// ─── World ──────────────────────────────────────────────────────────
export const globalConnections: GlobalConnection[] = [
  { id: '1', name: 'Anna S.', country: 'Germany', city: 'Berlin', lat: 52.52, lng: 13.405, strength: 88, type: 'friend' },
  { id: '2', name: 'Carlos M.', country: 'Spain', city: 'Barcelona', lat: 41.39, lng: 2.154, strength: 72, type: 'colleague' },
  { id: '3', name: 'Yuki T.', country: 'Japan', city: 'Tokyo', lat: 35.68, lng: 139.69, strength: 65, type: 'friend' },
  { id: '4', name: 'Sarah L.', country: 'USA', city: 'New York', lat: 40.71, lng: -74.006, strength: 91, type: 'family' },
  { id: '5', name: 'Priya K.', country: 'India', city: 'Mumbai', lat: 19.076, lng: 72.877, strength: 58, type: 'colleague' },
  { id: '6', name: 'James W.', country: 'Australia', city: 'Sydney', lat: -33.87, lng: 151.21, strength: 45, type: 'acquaintance' },
  { id: '7', name: 'Fatima A.', country: 'Morocco', city: 'Marrakech', lat: 31.63, lng: -7.98, strength: 52, type: 'friend' },
  { id: '8', name: 'Erik N.', country: 'Norway', city: 'Oslo', lat: 59.91, lng: 10.75, strength: 77, type: 'colleague' },
  { id: '9', name: 'Chen W.', country: 'China', city: 'Shanghai', lat: 31.23, lng: 121.47, strength: 63, type: 'colleague' },
  { id: '10', name: 'Maria G.', country: 'Brazil', city: 'São Paulo', lat: -23.55, lng: -46.63, strength: 70, type: 'friend' },
  { id: '11', name: 'David K.', country: 'Kenya', city: 'Nairobi', lat: -1.29, lng: 36.82, strength: 48, type: 'acquaintance' },
  { id: '12', name: 'Sophie D.', country: 'France', city: 'Paris', lat: 48.86, lng: 2.35, strength: 83, type: 'friend' },
];

export const culturalAffinities: CulturalAffinity[] = [
  { culture: 'European', score: 85, color: '#6366f1' },
  { culture: 'East Asian', score: 72, color: '#ec4899' },
  { culture: 'Latin American', score: 68, color: '#f59e0b' },
  { culture: 'South Asian', score: 55, color: '#10b981' },
  { culture: 'Middle Eastern', score: 48, color: '#8b5cf6' },
  { culture: 'African', score: 42, color: '#06b6d4' },
  { culture: 'North American', score: 78, color: '#ef4444' },
  { culture: 'Oceanian', score: 38, color: '#14b8a6' },
];

export const worldNewsInterests: WorldNewsInterest[] = [
  { topic: 'Technology', level: 92, category: 'tech' },
  { topic: 'Climate', level: 85, category: 'environment' },
  { topic: 'Space', level: 78, category: 'science' },
  { topic: 'Economics', level: 65, category: 'business' },
  { topic: 'Human Rights', level: 72, category: 'social' },
  { topic: 'Health', level: 60, category: 'health' },
  { topic: 'Geopolitics', level: 70, category: 'politics' },
  { topic: 'Arts & Culture', level: 55, category: 'culture' },
];

// ─── City ───────────────────────────────────────────────────────────
export const cityVisits: CityVisit[] = [
  {
    id: '1', name: 'Tokyo', country: 'Japan', rating: 5, daysSpent: 14,
    visitDate: '2024-03-15', impression: 'Mind-blowing blend of tradition and future. The food scene is unmatched.',
    tags: ['food', 'culture', 'technology'], lat: 35.68, lng: 139.69,
    scores: { food: 98, culture: 95, nightlife: 85, safety: 97, affordability: 45, nature: 60, architecture: 88, people: 90 },
  },
  {
    id: '2', name: 'Barcelona', country: 'Spain', rating: 5, daysSpent: 10,
    visitDate: '2024-06-20', impression: 'Gaudí everywhere, tapas around every corner. Perfect summer vibes.',
    tags: ['architecture', 'food', 'beach'], lat: 41.39, lng: 2.154,
    scores: { food: 90, culture: 88, nightlife: 92, safety: 70, affordability: 55, nature: 75, architecture: 96, people: 85 },
  },
  {
    id: '3', name: 'Berlin', country: 'Germany', rating: 4, daysSpent: 7,
    visitDate: '2024-01-10', impression: 'Raw creative energy. History at every corner. The techno scene is legendary.',
    tags: ['nightlife', 'history', 'art'], lat: 52.52, lng: 13.405,
    scores: { food: 72, culture: 90, nightlife: 98, safety: 75, affordability: 70, nature: 55, architecture: 78, people: 80 },
  },
  {
    id: '4', name: 'New York', country: 'USA', rating: 4, daysSpent: 12,
    visitDate: '2023-11-05', impression: 'The city that never sleeps lives up to its name. Overwhelming in the best way.',
    tags: ['food', 'culture', 'shopping'], lat: 40.71, lng: -74.006,
    scores: { food: 88, culture: 92, nightlife: 90, safety: 65, affordability: 25, nature: 40, architecture: 85, people: 60 },
  },
  {
    id: '5', name: 'Lisbon', country: 'Portugal', rating: 5, daysSpent: 8,
    visitDate: '2024-09-12', impression: 'Hidden gem of Europe. Pastel de nata changed my life. Incredible light.',
    tags: ['food', 'affordable', 'scenic'], lat: 38.72, lng: -9.14,
    scores: { food: 85, culture: 80, nightlife: 75, safety: 85, affordability: 80, nature: 70, architecture: 82, people: 92 },
  },
  {
    id: '6', name: 'Marrakech', country: 'Morocco', rating: 4, daysSpent: 5,
    visitDate: '2024-04-18', impression: 'Sensory overload in the souks. The riads are magical oases.',
    tags: ['culture', 'markets', 'exotic'], lat: 31.63, lng: -7.98,
    scores: { food: 82, culture: 95, nightlife: 40, safety: 60, affordability: 85, nature: 55, architecture: 90, people: 70 },
  },
  {
    id: '7', name: 'Copenhagen', country: 'Denmark', rating: 4, daysSpent: 4,
    visitDate: '2025-02-08', impression: 'Hygge is real. Cycling paradise. Noma was worth the wait.',
    tags: ['design', 'cycling', 'food'], lat: 55.68, lng: 12.57,
    scores: { food: 88, culture: 78, nightlife: 65, safety: 95, affordability: 30, nature: 70, architecture: 80, people: 88 },
  },
  {
    id: '8', name: 'Buenos Aires', country: 'Argentina', rating: 4, daysSpent: 9,
    visitDate: '2023-08-22', impression: 'Tango in San Telmo, steak in Palermo. A city of passionate souls.',
    tags: ['culture', 'food', 'nightlife'], lat: -34.60, lng: -58.38,
    scores: { food: 88, culture: 92, nightlife: 88, safety: 55, affordability: 75, nature: 45, architecture: 80, people: 85 },
  },
];

export const cityDNA: CityDNA[] = [
  { trait: 'Culture Seeker', value: 92 },
  { trait: 'Foodie', value: 88 },
  { trait: 'Night Owl', value: 75 },
  { trait: 'Budget Traveler', value: 45 },
  { trait: 'Nature Lover', value: 58 },
  { trait: 'Architecture Fan', value: 82 },
  { trait: 'Safety Conscious', value: 70 },
  { trait: 'Social Explorer', value: 80 },
];

// ─── Interests & Groups ─────────────────────────────────────────────
export const interests: Interest[] = [
  { id: '1', name: 'Photography', category: 'Creative', level: 78, hoursPerWeek: 5, startedYear: 2018, color: '#6366f1' },
  { id: '2', name: 'Rock Climbing', category: 'Sport', level: 62, hoursPerWeek: 4, startedYear: 2021, color: '#10b981' },
  { id: '3', name: 'Cooking', category: 'Lifestyle', level: 85, hoursPerWeek: 7, startedYear: 2016, color: '#f59e0b' },
  { id: '4', name: 'Machine Learning', category: 'Tech', level: 70, hoursPerWeek: 6, startedYear: 2020, color: '#ec4899' },
  { id: '5', name: 'Piano', category: 'Creative', level: 45, hoursPerWeek: 3, startedYear: 2022, color: '#8b5cf6' },
  { id: '6', name: 'Reading', category: 'Intellectual', level: 90, hoursPerWeek: 8, startedYear: 2010, color: '#06b6d4' },
  { id: '7', name: 'Yoga', category: 'Wellness', level: 55, hoursPerWeek: 3, startedYear: 2023, color: '#14b8a6' },
  { id: '8', name: 'Open Source', category: 'Tech', level: 72, hoursPerWeek: 4, startedYear: 2019, color: '#ef4444' },
];

export const groups: Group[] = [
  { id: '1', name: 'Street Photography Collective', type: 'online', members: 12400, engagement: 78, joinedDate: '2019-03-15' },
  { id: '2', name: 'Local Climbing Club', type: 'local', members: 85, engagement: 92, joinedDate: '2021-06-01' },
  { id: '3', name: 'AI/ML Research Group', type: 'professional', members: 340, engagement: 65, joinedDate: '2020-09-10' },
  { id: '4', name: 'Fermentation Enthusiasts', type: 'online', members: 5200, engagement: 55, joinedDate: '2022-01-20' },
  { id: '5', name: 'Book Club - Sci-Fi & Philosophy', type: 'local', members: 18, engagement: 88, joinedDate: '2021-11-01' },
  { id: '6', name: 'React Dev Community', type: 'online', members: 45000, engagement: 42, joinedDate: '2019-07-15' },
];

export const interestEvolution: InterestEvolution[] = [
  { month: 'Jan', Photography: 70, Cooking: 80, 'Machine Learning': 50, Reading: 85, 'Rock Climbing': 55 },
  { month: 'Feb', Photography: 72, Cooking: 78, 'Machine Learning': 55, Reading: 82, 'Rock Climbing': 58 },
  { month: 'Mar', Photography: 75, Cooking: 82, 'Machine Learning': 58, Reading: 88, 'Rock Climbing': 52 },
  { month: 'Apr', Photography: 74, Cooking: 79, 'Machine Learning': 62, Reading: 85, 'Rock Climbing': 60 },
  { month: 'May', Photography: 78, Cooking: 85, 'Machine Learning': 60, Reading: 90, 'Rock Climbing': 58 },
  { month: 'Jun', Photography: 76, Cooking: 83, 'Machine Learning': 65, Reading: 87, 'Rock Climbing': 62 },
  { month: 'Jul', Photography: 80, Cooking: 84, 'Machine Learning': 68, Reading: 86, 'Rock Climbing': 65 },
  { month: 'Aug', Photography: 78, Cooking: 86, 'Machine Learning': 70, Reading: 88, 'Rock Climbing': 60 },
  { month: 'Sep', Photography: 82, Cooking: 85, 'Machine Learning': 72, Reading: 90, 'Rock Climbing': 63 },
  { month: 'Oct', Photography: 80, Cooking: 88, 'Machine Learning': 75, Reading: 92, 'Rock Climbing': 58 },
  { month: 'Nov', Photography: 78, Cooking: 85, 'Machine Learning': 72, Reading: 89, 'Rock Climbing': 55 },
  { month: 'Dec', Photography: 82, Cooking: 88, 'Machine Learning': 78, Reading: 91, 'Rock Climbing': 50 },
];

// ─── Nearby ─────────────────────────────────────────────────────────
export const nearbyPlaces: NearbyPlace[] = [
  { id: '1', name: 'The Rustic Bean', type: 'cafe', rating: 4.8, visits: 47, distance: '0.3 km', favorite: true },
  { id: '2', name: 'Riverside Park', type: 'park', rating: 4.5, visits: 120, distance: '0.5 km', favorite: true },
  { id: '3', name: 'Umami Kitchen', type: 'restaurant', rating: 4.6, visits: 22, distance: '0.8 km', favorite: true },
  { id: '4', name: 'The Climbing Wall', type: 'gym', rating: 4.7, visits: 85, distance: '1.2 km', favorite: true },
  { id: '5', name: 'Vintage Vinyl Records', type: 'shop', rating: 4.3, visits: 8, distance: '0.6 km', favorite: false },
  { id: '6', name: 'City Library - East Branch', type: 'library', rating: 4.9, visits: 65, distance: '0.9 km', favorite: true },
  { id: '7', name: 'The Blue Note', type: 'bar', rating: 4.4, visits: 15, distance: '1.0 km', favorite: false },
  { id: '8', name: 'Modern Art Gallery', type: 'museum', rating: 4.2, visits: 6, distance: '1.5 km', favorite: false },
  { id: '9', name: 'Green Bowl Salads', type: 'restaurant', rating: 4.1, visits: 12, distance: '0.4 km', favorite: false },
  { id: '10', name: 'Zen Garden Yoga', type: 'gym', rating: 4.6, visits: 35, distance: '0.7 km', favorite: false },
];

export const localEvents: LocalEvent[] = [
  { id: '1', title: 'Farmers Market - Spring Edition', date: '2026-04-18', type: 'Market', attending: true, attendees: 250 },
  { id: '2', title: 'Open Mic Night at Blue Note', date: '2026-04-19', type: 'Music', attending: false, attendees: 45 },
  { id: '3', title: 'Community Clean-Up Day', date: '2026-04-20', type: 'Community', attending: true, attendees: 80 },
  { id: '4', title: 'Street Photography Walk', date: '2026-04-22', type: 'Hobby', attending: true, attendees: 15 },
  { id: '5', title: 'AI Meetup - Local Chapter', date: '2026-04-25', type: 'Tech', attending: true, attendees: 60 },
  { id: '6', title: 'Outdoor Cinema: Classic Films', date: '2026-04-26', type: 'Entertainment', attending: false, attendees: 120 },
];

export const neighborhoodScores: NeighborhoodScore[] = [
  { category: 'Walkability', score: 87, icon: 'Footprints' },
  { category: 'Safety', score: 82, icon: 'Shield' },
  { category: 'Green Space', score: 74, icon: 'TreePine' },
  { category: 'Dining', score: 91, icon: 'UtensilsCrossed' },
  { category: 'Transit', score: 78, icon: 'Train' },
  { category: 'Nightlife', score: 68, icon: 'Music' },
  { category: 'Culture', score: 85, icon: 'Landmark' },
  { category: 'Community', score: 79, icon: 'Heart' },
];

// ─── Friends ────────────────────────────────────────────────────────
export const friends: Friend[] = [
  { id: '1', name: 'Anna Schmidt', avatar: 'AS', metDate: '2018-09-01', strength: 92, sharedInterests: ['Photography', 'Cooking', 'Travel'], communicationFreq: 14, category: 'close', city: 'Berlin' },
  { id: '2', name: 'Marcus Chen', avatar: 'MC', metDate: '2020-03-15', strength: 85, sharedInterests: ['Machine Learning', 'Rock Climbing'], communicationFreq: 10, category: 'close', city: 'San Francisco' },
  { id: '3', name: 'Elena Rossi', avatar: 'ER', metDate: '2019-06-20', strength: 78, sharedInterests: ['Reading', 'Piano', 'Yoga'], communicationFreq: 7, category: 'regular', city: 'Milan' },
  { id: '4', name: 'Jake Torres', avatar: 'JT', metDate: '2021-01-10', strength: 70, sharedInterests: ['Rock Climbing', 'Photography'], communicationFreq: 5, category: 'regular', city: 'Denver' },
  { id: '5', name: 'Sophie Dubois', avatar: 'SD', metDate: '2017-11-05', strength: 88, sharedInterests: ['Cooking', 'Reading', 'Travel'], communicationFreq: 8, category: 'close', city: 'Paris' },
  { id: '6', name: 'Raj Patel', avatar: 'RP', metDate: '2022-04-18', strength: 55, sharedInterests: ['Machine Learning', 'Open Source'], communicationFreq: 3, category: 'casual', city: 'Bangalore' },
  { id: '7', name: 'Lisa Park', avatar: 'LP', metDate: '2020-08-22', strength: 65, sharedInterests: ['Yoga', 'Photography'], communicationFreq: 4, category: 'regular', city: 'Seoul' },
  { id: '8', name: 'Tom Wilson', avatar: 'TW', metDate: '2023-02-14', strength: 42, sharedInterests: ['Reading'], communicationFreq: 1, category: 'distant', city: 'London' },
  { id: '9', name: 'Mia Johnson', avatar: 'MJ', metDate: '2019-12-01', strength: 75, sharedInterests: ['Cooking', 'Photography', 'Yoga'], communicationFreq: 6, category: 'regular', city: 'Portland' },
  { id: '10', name: 'Daniel Kim', avatar: 'DK', metDate: '2021-07-30', strength: 60, sharedInterests: ['Machine Learning', 'Piano'], communicationFreq: 3, category: 'casual', city: 'Tokyo' },
];

export const socialCircles: SocialCircle[] = [
  { name: 'Close Friends', count: 3, color: '#ec4899' },
  { name: 'Regular', count: 4, color: '#8b5cf6' },
  { name: 'Casual', count: 2, color: '#06b6d4' },
  { name: 'Distant', count: 1, color: '#64748b' },
];

export const communicationPatterns: CommunicationPattern[] = [
  { day: 'Mon', messages: 24, calls: 2, meetups: 0 },
  { day: 'Tue', messages: 18, calls: 1, meetups: 1 },
  { day: 'Wed', messages: 32, calls: 3, meetups: 0 },
  { day: 'Thu', messages: 28, calls: 2, meetups: 1 },
  { day: 'Fri', messages: 45, calls: 4, meetups: 2 },
  { day: 'Sat', messages: 52, calls: 3, meetups: 3 },
  { day: 'Sun', messages: 38, calls: 2, meetups: 1 },
];

export const diversityIndex: DiversityIndex[] = [
  { dimension: 'Geographic', score: 82, description: 'Friends across 8 countries on 4 continents' },
  { dimension: 'Professional', score: 75, description: 'Mix of tech, creative, academic, and trades' },
  { dimension: 'Age Range', score: 60, description: 'Mostly 25-40, some older connections' },
  { dimension: 'Cultural', score: 78, description: 'Strong cross-cultural friendships' },
  { dimension: 'Interest Overlap', score: 65, description: 'Moderate shared interests, unique perspectives' },
  { dimension: 'Communication Style', score: 70, description: 'Balanced digital and in-person' },
];
