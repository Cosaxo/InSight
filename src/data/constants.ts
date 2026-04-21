import { C } from "../theme";
import type {
  MediaOptionsMap,
  RelationCategory,
  Hero,
  MediaMap,
} from "../types";

export const P_TRAITS = ["Open", "Consc.", "Extra.", "Agree.", "Resil."] as const;

export const MY_INTS = [
  "Technology",
  "Philosophy",
  "Travel",
  "Architecture",
  "Science",
  "Design",
  "Photography",
];

export const CAT_META: Record<
  RelationCategory,
  { label: string; color: string }
> = {
  family: { label: "Family", color: C.red },
  close: { label: "Close", color: C.teal },
  friend: { label: "Friend", color: C.green },
  work: { label: "Work", color: C.amber },
  acquaintance: { label: "Acquaintance", color: C.muted },
};

export const MEDIA_OPTIONS: MediaOptionsMap = {
  music: {
    label: "Music",
    icon: "♪",
    color: C.purple,
    genres: [
      "Electronic",
      "Jazz",
      "Classical",
      "Hip-Hop",
      "Rock",
      "Indie",
      "Folk",
      "Pop",
      "Metal",
      "R&B",
      "Ambient",
      "Soul",
    ],
  },
  film: {
    label: "Film",
    icon: "▶",
    color: C.red,
    genres: [
      "Sci-Fi",
      "Documentary",
      "Drama",
      "Comedy",
      "Thriller",
      "Horror",
      "Animation",
      "Action",
      "Art-house",
      "Romance",
      "Fantasy",
    ],
  },
  books: {
    label: "Books",
    icon: "≡",
    color: C.amber,
    genres: [
      "Non-fiction",
      "Philosophy",
      "Science",
      "Fiction",
      "History",
      "Psychology",
      "Biography",
      "Fantasy",
      "Poetry",
      "Economics",
    ],
  },
  podcasts: {
    label: "Podcasts",
    icon: "◎",
    color: C.teal,
    genres: [
      "Technology",
      "History",
      "Science",
      "True Crime",
      "Comedy",
      "Politics",
      "Culture",
      "Sport",
      "Business",
      "Health",
    ],
  },
};

export const DEFAULT_MY_MEDIA: MediaMap = {
  music: ["Electronic", "Jazz", "Ambient", "Indie", "Classical"],
  film: ["Sci-Fi", "Documentary", "Art-house", "Drama"],
  books: ["Non-fiction", "Philosophy", "Science", "Psychology"],
  podcasts: ["Technology", "History", "Science"],
};

export const DEFAULT_MY_LIKES = [
  "Long walks",
  "Black coffee",
  "Cities at night",
  "Deep work",
  "Rainy days",
  "Bookshops",
  "Minimalism",
  "Architecture",
];

export const DEFAULT_MY_DISLIKES = [
  "Small talk",
  "Notifications",
  "Processed food",
  "Open-plan offices",
  "Rushed meals",
  "Crowds",
];

export const DEFAULT_MY_HEROES: Hero[] = [
  {
    name: "Carl Sagan",
    role: "Astronomer",
    reason: "Made the cosmos feel personal and wonder-filled",
  },
  {
    name: "Hannah Arendt",
    role: "Philosopher",
    reason: "Courage to think differently in the darkest times",
  },
  {
    name: "David Bowie",
    role: "Artist",
    reason: "Proved you can reinvent yourself endlessly",
  },
];

export const CITY_FLAGS: Record<string, string> = {
  Oslo: "🇳🇴",
  Berlin: "🇩🇪",
  Tokyo: "🇯🇵",
  Amsterdam: "🇳🇱",
  Barcelona: "🇪🇸",
  "New York": "🇺🇸",
  Lisbon: "🇵🇹",
  Seoul: "🇰🇷",
};
